import os
import numpy as np
from plyfile import PlyData, PlyElement
import logging
import tempfile
import random

logger = logging.getLogger(__name__)

def downsample_ply(input_path, output_path=None, keep_ratio=0.5):
    """
    将PLY文件按指定保留比例进行降采样
    
    参数:
        input_path (str): 输入PLY文件路径
        output_path (str): 输出PLY文件路径，如果为None则创建临时文件
        keep_ratio (float): 要保留的点云比例 (0.0-1.0)
    
    返回:
        str: 降采样后的文件路径
    """
    logger.info(f"开始降采样PLY文件: {input_path}，保留率: {keep_ratio}")
    
    # 如果没有指定输出路径，创建临时文件
    if output_path is None:
        temp_dir = tempfile.gettempdir()
        output_path = os.path.join(temp_dir, f"downsampled_{os.path.basename(input_path)}")
    
    # 获取输入文件大小
    input_size_mb = os.path.getsize(input_path) / (1024 * 1024)
    logger.info(f"输入文件大小: {input_size_mb:.2f} MB")
    
    # 确保保留率在有效范围内
    keep_ratio = max(0.01, min(1.0, keep_ratio))
    
    # 读取PLY文件
    try:
        plydata = PlyData.read(input_path)
    except Exception as e:
        logger.error(f"读取PLY文件出错: {str(e)}")
        raise
    
    # 获取顶点数据
    vertex = plydata['vertex']
    
    # 计算采样数量
    orig_vertex_count = len(vertex)
    sample_count = int(orig_vertex_count * keep_ratio)
    if sample_count <= 0:
        sample_count = 1  # 确保至少有一个点
    
    logger.info(f"原始点数: {orig_vertex_count}, 采样点数: {sample_count}, 保留率: {keep_ratio}")
    
    # 随机采样索引 - 使用分层采样方式以保持原始点云的形状特征
    if keep_ratio < 1.0:
        # 分层采样：将点云划分为小区域，从每个区域采样
        try:
            # 基于空间位置进行聚类采样
            x = np.array(vertex['x'])
            y = np.array(vertex['y'])
            z = np.array(vertex['z'])
            
            # 计算点云的边界盒
            x_min, x_max = x.min(), x.max()
            y_min, y_max = y.min(), y.max()
            z_min, z_max = z.min(), z.max()
            
            # 根据点云密度确定采样策略
            if orig_vertex_count > 1000000:  # 对于大点云
                # 空间哈希采样：将3D空间划分为网格
                grid_size = 100  # 网格数量
                x_bins = np.linspace(x_min, x_max, grid_size)
                y_bins = np.linspace(y_min, y_max, grid_size)
                z_bins = np.linspace(z_min, z_max, grid_size)
                
                x_indices = np.digitize(x, x_bins)
                y_indices = np.digitize(y, y_bins)
                z_indices = np.digitize(z, z_bins)
                
                # 组合索引形成空间哈希
                grid_indices = x_indices * grid_size**2 + y_indices * grid_size + z_indices
                unique_grids = np.unique(grid_indices)
                
                # 从每个非空网格中采样
                indices = []
                for grid_idx in unique_grids:
                    grid_points = np.where(grid_indices == grid_idx)[0]
                    # 从该网格中取样 keep_ratio 比例的点
                    grid_sample_count = max(1, int(len(grid_points) * keep_ratio))
                    if len(grid_points) > 0:
                        grid_samples = np.random.choice(grid_points, min(grid_sample_count, len(grid_points)), replace=False)
                        indices.extend(grid_samples)
                
                # 如果总采样点数与目标不符，调整
                if len(indices) > sample_count:
                    indices = np.random.choice(indices, sample_count, replace=False)
                elif len(indices) < sample_count and len(indices) < orig_vertex_count:
                    # 随机添加一些未被选中的点
                    remaining = np.setdiff1d(np.arange(orig_vertex_count), indices)
                    additional = np.random.choice(remaining, min(sample_count - len(indices), len(remaining)), replace=False)
                    indices = np.concatenate([indices, additional])
                
                indices = sorted(indices)
            else:
                # 对于较小的点云，简单随机采样即可
                indices = random.sample(range(orig_vertex_count), sample_count)
                indices.sort()  # 排序以保留相对顺序
        except Exception as e:
            logger.error(f"分层采样失败: {str(e)}，回退到随机采样")
            # 回退到普通随机采样
            indices = random.sample(range(orig_vertex_count), sample_count)
            indices.sort()  # 排序以保留相对顺序
    else:
        # 保留所有点
        indices = list(range(orig_vertex_count))
    
    # 提取属性名和数据类型
    dtype_list = []
    for prop in vertex.properties:
        # 直接使用dtype的值而不是bound method
        dtype_name = prop.dtype.__str__()
        if 'float' in dtype_name.lower():
            dtype = np.float32
        elif 'double' in dtype_name.lower():
            dtype = np.float64
        elif 'int8' in dtype_name.lower() or 'uchar' in dtype_name.lower():
            dtype = np.uint8
        elif 'int16' in dtype_name.lower() or 'short' in dtype_name.lower():
            dtype = np.int16
        elif 'int32' in dtype_name.lower() or 'int' in dtype_name.lower():
            dtype = np.int32
        else:
            # 默认使用float32
            logger.warning(f"未知的数据类型: {dtype_name}, 使用float32代替")
            dtype = np.float32
        
        dtype_list.append((prop.name, dtype))
    
    logger.info(f"属性数据类型: {dtype_list}")
    
    # 创建新的顶点数据
    vertex_data = np.zeros(len(indices), dtype=dtype_list)
    
    # 复制采样顶点的属性
    for prop in vertex.properties:
        name = prop.name
        vertex_data[name] = vertex[name][indices]
    
    # 创建新的PLY元素
    new_vertex = PlyElement.describe(vertex_data, 'vertex')
    
    # 如果有其他元素（如face），也需要处理
    elements = [new_vertex]
    
    for el in plydata.elements:
        if el.name != 'vertex':
            elements.append(el)
    
    # 创建新的PLY数据
    new_plydata = PlyData(elements, plydata.text, plydata.byte_order, plydata.comments)
    
    # 写入新文件
    new_plydata.write(output_path)
    logger.info(f"降采样完成，文件保存到: {output_path}")
    
    # 验证新文件大小
    output_size_mb = os.path.getsize(output_path) / (1024 * 1024)
    logger.info(f"输出文件大小: {output_size_mb:.2f} MB ({output_size_mb/input_size_mb:.2%} 的原始大小)")
    
    return output_path 