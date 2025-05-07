from flask import Flask, request, jsonify, send_from_directory, send_file
import os
import numpy as np
from plyfile import PlyData
import json
from flask_cors import CORS
import logging
from downsample import downsample_ply  # 导入降采样功能
import uuid

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # 启用CORS以允许前端访问

UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'ply'}
MAX_POINTS = 4000000  # 最大点数限制为400万

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 2 * 1024 * 1024 * 1024  # 限制上传大小为2gb

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def check_vertex_properties(vertex):
    """检查顶点元素的属性，输出详细信息以帮助调试"""
    property_names = [prop.name for prop in vertex.properties]
    logger.info(f"点云包含的属性: {property_names}")
    
    # 检查是否有颜色属性
    color_props = ['red', 'green', 'blue']
    has_colors = all(prop in property_names for prop in color_props)
    
    if has_colors:
        logger.info("检测到颜色属性: red, green, blue")
        # 显示前几个顶点的颜色样本
        sample_count = min(5, len(vertex))
        for i in range(sample_count):
            r = vertex['red'][i]
            g = vertex['green'][i]
            b = vertex['blue'][i]
            logger.info(f"颜色样本 {i+1}: R={r}, G={g}, B={b}")
    else:
        logger.info("未检测到标准颜色属性 (red, green, blue)")
        
    return has_colors

@app.route('/api/upload', methods=['POST'])
def upload_file():
    logger.info("接收到文件上传请求")
    if 'file' not in request.files:
        logger.warning("没有选择文件")
        return jsonify({'error': '没有选择文件'}), 400
    
    file = request.files['file']
    if file.filename == '':
        logger.warning("没有选择文件")
        return jsonify({'error': '没有选择文件'}), 400
    
    if file and allowed_file(file.filename):
        filename = file.filename
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        logger.info(f"文件已保存到 {filepath}")
        
        # 解析PLY文件获取元数据
        try:
            plydata = PlyData.read(filepath)
            vertex = plydata['vertex']
            
            # 获取点数
            num_points = len(vertex)
            logger.info(f"点云包含 {num_points} 个点")
            
            # 检查点数是否超过限制
            if num_points > MAX_POINTS:
                # 删除上传的文件
                try:
                    os.remove(filepath)
                except:
                    pass
                logger.warning(f"点数超过限制 ({num_points} > {MAX_POINTS})")
                return jsonify({
                    'error': f'点云包含 {num_points} 个点，超过了400万点的限制。请先使用降采样工具处理后再上传。'
                }), 400
            
            # 检查是否有颜色信息
            has_colors = check_vertex_properties(vertex)
            
            return jsonify({
                'success': True,
                'filename': filename,
                'total_points': num_points,
                'has_colors': has_colors
            })
        except Exception as e:
            logger.error(f"解析PLY文件时出错: {str(e)}")
            return jsonify({'error': f'解析PLY文件时出错: {str(e)}'}), 500
    
    logger.warning("只允许上传PLY文件")
    return jsonify({'error': '只允许上传PLY文件'}), 400

@app.route('/api/pointcloud/<filename>', methods=['GET'])
def get_pointcloud(filename):
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    logger.info(f"正在处理点云数据请求: {filename}")
    
    if not os.path.exists(filepath):
        logger.warning(f"文件不存在: {filepath}")
        return jsonify({'error': '文件不存在'}), 404
    
    try:
        plydata = PlyData.read(filepath)
        vertex = plydata['vertex']
        
        # 提取点坐标
        x = vertex['x']
        y = vertex['y']
        z = vertex['z']
        
        points = [[float(x[i]), float(y[i]), float(z[i])] for i in range(len(vertex))]
        logger.info(f"成功提取了 {len(points)} 个点的坐标")
        
        # 检查顶点属性
        property_names = [prop.name for prop in vertex.properties]
        logger.info(f"点云包含的属性: {property_names}")
        
        # 如果有颜色信息，提取出来
        colors = None
        color_props = ['red', 'green', 'blue']
        
        if all(prop in property_names for prop in color_props):
            try:
                logger.info("点云有颜色信息，正在提取...")
                r = vertex['red']
                g = vertex['green']
                b = vertex['blue']
                
                # 先检查一些颜色样本
                sample_count = min(5, len(vertex))
                for i in range(sample_count):
                    logger.info(f"颜色样本 {i+1}: R={r[i]}, G={g[i]}, B={b[i]}")
                
                # 确保颜色数据转换为整数
                colors = []
                for i in range(len(vertex)):
                    r_val = int(r[i]) if hasattr(r[i], '__int__') else r[i]
                    g_val = int(g[i]) if hasattr(g[i], '__int__') else g[i]
                    b_val = int(b[i]) if hasattr(b[i], '__int__') else b[i]
                    colors.append([r_val, g_val, b_val])
                
                logger.info(f"成功提取了 {len(colors)} 个点的颜色")
                
                # 记录一些颜色样本用于调试
                if len(colors) > 0:
                    samples = colors[:5]
                    logger.info(f"颜色样本: {samples}")
            except Exception as color_error:
                logger.error(f"提取颜色时出错: {str(color_error)}")
        else:
            logger.info("点云没有标准颜色信息 (red, green, blue)")
        
        response = {
            'points': points,
            'total_points': len(points)
        }
        
        if colors:
            response['colors'] = colors
            logger.info(f"响应包含 {len(colors)} 个颜色数据")
        
        return jsonify(response)
    except Exception as e:
        logger.error(f"读取点云数据时出错: {str(e)}")
        return jsonify({'error': f'读取点云数据时出错: {str(e)}'}), 500

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/api/analyze/<filename>', methods=['GET'])
def analyze_ply_file(filename):
    """分析PLY文件的详细结构，用于调试"""
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    
    if not os.path.exists(filepath):
        return jsonify({'error': '文件不存在'}), 404
    
    try:
        plydata = PlyData.read(filepath)
        
        # 收集所有元素信息
        elements = []
        for element in plydata.elements:
            elem_info = {
                'name': element.name,
                'count': len(element),
                'properties': []
            }
            
            # 收集属性信息
            for prop in element.properties:
                prop_info = {
                    'name': prop.name,
                    'dtype': str(prop.dtype)
                }
                elem_info['properties'].append(prop_info)
            
            elements.append(elem_info)
        
        # 如果有顶点元素，收集一些样本数据
        samples = []
        if 'vertex' in plydata:
            vertex = plydata['vertex']
            sample_count = min(5, len(vertex))
            
            # 输出所有可用的属性名
            property_names = [p.name for p in vertex.properties]
            logger.info(f"点云包含的属性: {property_names}")
            
            for i in range(sample_count):
                sample = {}
                for prop in vertex.properties:
                    try:
                        value = vertex[prop.name][i]
                        # 将NumPy类型转换为Python原生类型
                        if hasattr(value, 'item'):
                            value = value.item()
                        sample[prop.name] = value
                    except Exception as sample_error:
                        sample[prop.name] = f"ERROR: {str(sample_error)}"
                samples.append(sample)
        
        result = {
            'file': filename,
            'format': plydata.format,
            'version': plydata.version,
            'elements': elements,
            'vertex_samples': samples if samples else None
        }
        
        return jsonify(result)
    except Exception as e:
        logger.error(f"分析PLY文件时出错: {str(e)}")
        return jsonify({'error': f'分析PLY文件时出错: {str(e)}'}), 500

@app.route('/api/downsample', methods=['POST'])
def downsample_file():
    """
    对PLY文件进行降采样
    可以指定保留点的百分比 (10%, 25%, 50%, 75%)
    """
    logger.info("接收到降采样请求")
    if 'file' not in request.files:
        logger.warning("没有选择文件")
        return jsonify({'error': '没有选择文件'}), 400
    
    file = request.files['file']
    if file.filename == '':
        logger.warning("没有选择文件")
        return jsonify({'error': '没有选择文件'}), 400
    
    # 获取降采样比例参数，默认为0.5 (50%)
    keep_ratio = float(request.form.get('keep_ratio', 0.5))
    
    # 验证keep_ratio是否在有效范围内
    if keep_ratio < 0.01 or keep_ratio > 1.0:
        logger.warning(f"无效的保留率: {keep_ratio}，使用默认值0.5")
        keep_ratio = 0.5
    
    logger.info(f"用户选择的降采样保留率: {keep_ratio}")
    
    if file and allowed_file(file.filename):
        # 获取原始文件名并处理特殊字符
        orig_filename = file.filename
        # 清理文件名，移除或替换不允许的字符
        safe_filename = "".join([c for c in orig_filename if c.isalnum() or c in "._- "]).rstrip()
        if not safe_filename:
            safe_filename = "file.ply"
        
        # 创建唯一的临时文件名
        unique_id = str(uuid.uuid4())[:8]
        temp_filename = f"temp_{unique_id}_{safe_filename}"
        output_filename = f"downsampled_{unique_id}_{safe_filename}"
        
        # 完整路径
        temp_upload_path = os.path.join(app.config['UPLOAD_FOLDER'], temp_filename)
        output_path = os.path.join(app.config['UPLOAD_FOLDER'], output_filename)
        
        logger.info(f"保存上传文件到: {temp_upload_path}")
        
        try:
            # 保存上传的文件
            file.save(temp_upload_path)
            
            # 获取文件大小
            file_size_mb = os.path.getsize(temp_upload_path) / (1024 * 1024)
            logger.info(f"接收到的文件大小: {file_size_mb:.2f} MB")
            
            # 降采样文件
            logger.info(f"开始降采样过程，保留率: {keep_ratio}")
            
            # 调用降采样功能
            try:
                downsampled_path = downsample_ply(temp_upload_path, output_path, keep_ratio)
                logger.info(f"降采样完成: {downsampled_path}")
                
                # 返回降采样后的文件
                return send_file(downsampled_path, 
                                as_attachment=True, 
                                download_name=f"downsampled_{keep_ratio:.2f}_{safe_filename}")
            except Exception as e:
                logger.error(f"降采样过程中出错: {str(e)}")
                return jsonify({'error': f'降采样过程中出错: {str(e)}'}), 500
                
        except Exception as e:
            logger.error(f"处理文件时出错: {str(e)}")
            return jsonify({'error': f'处理文件时出错: {str(e)}'}), 500
        finally:
            # 尝试清理临时文件
            try:
                if os.path.exists(temp_upload_path):
                    os.unlink(temp_upload_path)
            except Exception as e:
                logger.warning(f"清理临时文件时出错: {str(e)}")
    
    logger.warning("只允许上传PLY文件")
    return jsonify({'error': '只允许上传PLY文件'}), 400

if __name__ == '__main__':
    logger.info("后端服务器启动在 http://0.0.0.0:8085")
    app.run(host='0.0.0.0', port=8085, debug=True) 