from flask import Flask, request, jsonify, send_from_directory, send_file, Response, stream_with_context
import os
import numpy as np
from plyfile import PlyData
import json
from flask_cors import CORS
import logging
from downsample import downsample_ply  # 导入降采样功能
import uuid
import requests  # 用于调用 LLM 接口
from typing import Any, Dict, List

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # 启用CORS以允许前端访问

UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'ply'}
MAX_POINTS = 5000000  # 最大点数限制为500万

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 2 * 1024 * 1024 * 1024  # 限制上传大小为2gb

def summarize_pointcloud(filepath: str, max_samples: int = 100) -> Dict[str, Any]:
    """
    将点云的关键统计信息提炼为结构化 JSON，并保存在同目录下（方便后续复用）。
    - filepath: uploads/ 下的 .ply 文件路径
    - max_samples: 抽样点数量上限（默认 100）
    """
    base_json_path = filepath + '.summary.json'
    if os.path.exists(base_json_path):
        try:
            with open(base_json_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"读取点云摘要 JSON 失败，重新生成: {e}")

    plydata = PlyData.read(filepath)
    vertex = plydata['vertex']
    total_points = len(vertex)

    x = np.array(vertex['x'], dtype=np.float64)
    y = np.array(vertex['y'], dtype=np.float64)
    z = np.array(vertex['z'], dtype=np.float64)

    stats: Dict[str, Any] = {
        'filename': os.path.basename(filepath),
        'total_points': int(total_points),
        'bounding_box': {
            'x_min': float(np.min(x)) if total_points else None,
            'x_max': float(np.max(x)) if total_points else None,
            'y_min': float(np.min(y)) if total_points else None,
            'y_max': float(np.max(y)) if total_points else None,
            'z_min': float(np.min(z)) if total_points else None,
            'z_max': float(np.max(z)) if total_points else None,
        },
        'centroid': {
            'x': float(np.mean(x)) if total_points else None,
            'y': float(np.mean(y)) if total_points else None,
            'z': float(np.mean(z)) if total_points else None,
        },
    }

    color_props = ['red', 'green', 'blue']
    property_names = [prop.name for prop in vertex.properties]
    has_colors = all(prop in property_names for prop in color_props)
    stats['has_colors'] = has_colors

    if has_colors:
        r = np.array(vertex['red'], dtype=np.float64)
        g = np.array(vertex['green'], dtype=np.float64)
        b = np.array(vertex['blue'], dtype=np.float64)
        stats['color_stats'] = {
            'avg_rgb': [
                float(np.mean(r)),
                float(np.mean(g)),
                float(np.mean(b))
            ],
            'min_rgb': [
                float(np.min(r)),
                float(np.min(g)),
                float(np.min(b))
            ],
            'max_rgb': [
                float(np.max(r)),
                float(np.max(g)),
                float(np.max(b))
            ]
        }

    # 均匀抽样 max_samples 个点，方便放入 prompt
    sample_size = min(max_samples, total_points)
    samples: List[Dict[str, Any]] = []
    if sample_size > 0:
        indices = np.linspace(0, total_points - 1, sample_size, dtype=int)
        for idx in indices:
            point_info = {
                'x': float(x[idx]),
                'y': float(y[idx]),
                'z': float(z[idx])
            }
            if has_colors:
                point_info['color'] = {
                    'r': int(vertex['red'][idx]),
                    'g': int(vertex['green'][idx]),
                    'b': int(vertex['blue'][idx])
                }
            samples.append(point_info)
    stats['sample_points'] = samples

    try:
        with open(base_json_path, 'w', encoding='utf-8') as f:
            json.dump(stats, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.warning(f"写入点云摘要 JSON 失败: {e}")

    return stats

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
                    'error': f'{num_points} points, exceeded 400M points limit. Please use the "point cloud down-sampling tool" at the top of the page to reduce the point cloud density first.'
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

@app.route('/api/pointcloud/<filename>/summary', methods=['GET'])
def download_pointcloud_summary(filename):
    """
    下载（或生成）点云的统计摘要 JSON。
    - 若本地已存在 *.summary.json，则直接返回；
    - 否则先调用 summarize_pointcloud 生成后再返回。
    """
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    if not os.path.exists(filepath):
        return jsonify({'error': '文件不存在'}), 404

    try:
        stats = summarize_pointcloud(filepath)
    except Exception as e:
        logger.error(f"生成摘要失败: {e}")
        return jsonify({'error': f'生成摘要失败: {str(e)}'}), 500

    summary_path = filepath + '.summary.json'
    if not os.path.exists(summary_path):
        # 兜底：如果写文件失败，就直接把 JSON 返回
        return jsonify(stats)

    return send_file(
        summary_path,
        as_attachment=True,
        download_name=f"{filename}.summary.json",
        mimetype='application/json'
    )

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

@app.route('/api/llm/stream_file', methods=['GET'])
def stream_file_analysis():
    """
    基于 SSE 的流式分析接口：
    - 前端通过 EventSource 以 GET 建立连接；
    - 查询参数：
        - filename: 已通过 /api/upload 上传并保存在 uploads/ 下的 .ply 文件名
        - lang: 输出语言，'zh' 或 'en'
    - 后端将文件交由大模型进行分析，并将生成的文本以 SSE 形式实时推送给前端。
    
    重要说明：
    - 这里使用 OpenAI Chat Completions 流式接口（/v1/chat/completions）：
      将“分析指令 + 点云统计摘要（JSON）”作为 prompt 传入，让模型生成文字分析，同时在服务器端缓存该 JSON。
    - 如需“文件上传 + 引用”（Assistants API），可扩展为：
      1) 先将文件通过 files 接口上传，得到 file_id；
      2) 再在可引用文件的端点里创建流式响应；此处保留结构，便于替换实现。
    """
    # 优先使用前端传来的 api_key（允许用户在前端自行输入），否则 fallback 到环境变量

    # request 对象：这是 Flask 框架提供的一个全局对象，用于接收和处理 HTTP 请求
    # request.args：这是一个字典，专门存放 URL 查询参数 (Query Parameters)。
    # 例如，前端访问的 URL 是：http://localhost:8085/api/llm/stream_file?filename=abc.ply&lang=zh&api_key=sk-123456
    # 那么 request.args 里就有：
    #   filename: "abc.ply"
    #   lang: "zh"
    #   api_key: "sk-123456"
    # .get('api_key', '')：从字典里取 api_key 的值。如果 URL 里没带这个参数，就返回空字符串 ''（防止程序报错）。
    api_key = request.args.get('api_key', '', type=str).strip()
    if not api_key:
        api_key = os.environ.get('OPENAI_API_KEY', '').strip()
    if not api_key:
        return Response(_sse_error('缺少 OpenAI API Key（请在前端输入或配置 OPENAI_API_KEY）'), mimetype='text/event-stream')

    filename = request.args.get('filename', '', type=str)
    lang = request.args.get('lang', 'zh', type=str)
    if lang not in ('zh', 'en'):
        lang = 'zh'

    if not filename:
        return Response(_sse_error('缺少 filename 参数'), mimetype='text/event-stream')

    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    if not os.path.exists(file_path):
        return Response(_sse_error('文件不存在'), mimetype='text/event-stream')

    # 该 URL 用于让模型知晓“文件的下载地址”（某些模型不可主动拉取，此方式仅作上下文提示）
    file_url = request.host_url.rstrip('/') + f'/uploads/{filename}'

    # 读取/生成点云统计摘要，并存为 JSON 文件
    try:
        stats = summarize_pointcloud(file_path)
    except Exception as e:
        logger.error(f"生成点云摘要失败: {e}")
        return Response(_sse_error('生成点云摘要失败'), mimetype='text/event-stream')

    stats_text = json.dumps(stats, ensure_ascii=False, indent=2)

    # 根据语言构造系统提示词与用户提示词
    if lang == 'zh':
        system_prompt = (
            "你是三维点云分析专家。请以通俗中文给出结构化分析，先结论后细节，"
            "包括但不限于：整体概述、几何范围与分布、颜色特征（如有）、"
            "数据质量（噪声/离群点/密度不均）、可视化与下游处理建议。"
        )
        user_prompt = (
            f"点云文件：{filename}\n"
            f"统计摘要 JSON：\n{stats_text}\n"
            "请严格根据上述量化信息，给出结构化中文分析（结论、几何范围、颜色特征、"
            "数据质量、下游处理建议等），若信息不足可提示不确定性。"
        )
    else:
        system_prompt = (
            "You are an expert in 3D point cloud analysis. Provide a structured analysis in clear English, "
            "starting with key conclusions followed by details: overall description, geometric ranges and distribution, "
            "color characteristics (if any), data quality (noise/outliers/density), "
            "and suggestions for visualization and downstream processing."
        )
        user_prompt = (
            f"Point cloud file: {filename}\n"
            f"Statistics JSON:\n{stats_text}\n"
            "Please generate a structured English analysis strictly based on the provided data "
            "(summary, geometry, colors, quality, downstream suggestions). "
            "Call out any uncertainty if the stats do not contain enough evidence."
        )

    def generate():
        # 标准 SSE 响应头由外层 Response 设置；此生成器负责逐步写入 data 行
        try:
            # OpenAI Chat Completions 流式接口
            # 模型可按需调整：如 gpt-4o / gpt-4o-mini 等
            url = 'https://api.openai.com/v1/chat/completions'
            headers = {
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            }
            payload = {
                'model': 'gpt-4o-mini',
                'messages': [
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': user_prompt}
                ],
                'temperature': 0.3,
                'stream': True
            }
            # requests是一个库，用于发送HTTP请求。
            # 这里向 OpenAI 发起流式请求 (stream=True)，OpenAI 给一点数据，r 就收到一点
            with requests.post(url, headers=headers, data=json.dumps(payload), stream=True, timeout=(10, 600)) as r:
                r.raise_for_status()
                # 逐行解析出token（openai的流式api每行返回一个token），直到 "data: [DONE]"
                for raw_line in r.iter_lines(decode_unicode=True):
                    if not raw_line:
                        continue
                    if raw_line.startswith('data: '):
                        data_str = raw_line[len('data: '):].strip()
                        if data_str == '[DONE]':
                            # 向前端发送完成信号
                            yield 'event: done\ndata: [DONE]\n\n'
                            break
                        # 解析 JSON，提取 delta 内容
                        try:
                            obj = json.loads(data_str)
                            # OpenAI/DeepSeek 兼容格式：choices[0].delta.content
                            choices = obj.get('choices') or []
                            if choices:
                                delta = choices[0].get('delta') or {}
                                content = delta.get('content')
                                if content:
                                    # 关键：使用 yield 逐步产出数据，每次 yield，Flask 就会把这部分数据通过网络发给前端
                                    # yield两次是为了兼容不同前端监听方式的保险写法
                                    yield f'data: {content}\n\n' # eventSource 默认监听 data 事件
                                    yield f'event: delta\ndata: {content}\n\n' # 自定义监听 delta 事件
                        except Exception as parse_err:
                            logger.warning(f"SSE 解析错误: {parse_err}")
                            # 不中断，尝试继续后续数据
                            continue
        except requests.HTTPError as http_err:
            logger.error(f"OpenAI HTTP 错误: {http_err}")
            yield _sse_error('大模型服务请求失败（HTTP）')
        except requests.RequestException as req_err:
            logger.error(f"OpenAI 请求异常: {req_err}")
            yield _sse_error('大模型服务连接异常')
        except Exception as e:
            logger.error(f"SSE 流式处理异常: {e}")
            yield _sse_error('服务器内部错误')

    # 返回一个标准的 SSE 响应
    headers = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        # 反向代理（如 Nginx）下可禁用缓冲，确保流式
        'X-Accel-Buffering': 'no'
    }
    return Response(stream_with_context(generate()), headers=headers)

def _sse_error(msg: str) -> str:
    """
    将错误以 SSE 的形式返回给前端并结束。
    - 约定：错误使用 event: error；前端收到后提示并关闭连接
    """
    return f'event: error\ndata: {msg}\n\n'

if __name__ == '__main__':
    logger.info("后端服务器启动在 http://0.0.0.0:8085")
    app.run(host='0.0.0.0', port=8085, debug=True) 