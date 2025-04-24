from flask import Flask, request, jsonify, send_from_directory
import os
import numpy as np
from plyfile import PlyData
import json
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # 启用CORS以允许前端访问

UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'ply'}

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 限制上传大小为500MB

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': '没有选择文件'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400
    
    if file and allowed_file(file.filename):
        filename = file.filename
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # 解析PLY文件获取元数据
        try:
            plydata = PlyData.read(filepath)
            vertex = plydata['vertex']
            
            # 获取点数
            num_points = len(vertex)
            
            # 检查是否有颜色信息
            has_colors = all(prop in vertex.properties for prop in ['red', 'green', 'blue'])
            
            return jsonify({
                'success': True,
                'filename': filename,
                'total_points': num_points,
                'has_colors': has_colors
            })
        except Exception as e:
            return jsonify({'error': f'解析PLY文件时出错: {str(e)}'}), 500
    
    return jsonify({'error': '只允许上传PLY文件'}), 400

@app.route('/api/pointcloud/<filename>', methods=['GET'])
def get_pointcloud(filename):
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    
    if not os.path.exists(filepath):
        return jsonify({'error': '文件不存在'}), 404
    
    try:
        plydata = PlyData.read(filepath)
        vertex = plydata['vertex']
        
        # 提取点坐标
        x = vertex['x']
        y = vertex['y']
        z = vertex['z']
        
        points = [[float(x[i]), float(y[i]), float(z[i])] for i in range(len(vertex))]
        
        # 如果有颜色信息，也提取出来
        colors = None
        if all(prop in vertex.properties for prop in ['red', 'green', 'blue']):
            r = vertex['red']
            g = vertex['green']
            b = vertex['blue']
            colors = [[int(r[i]), int(g[i]), int(b[i])] for i in range(len(vertex))]
        
        response = {
            'points': points,
            'total_points': len(points)
        }
        
        if colors:
            response['colors'] = colors
        
        return jsonify(response)
    except Exception as e:
        return jsonify({'error': f'读取点云数据时出错: {str(e)}'}), 500

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8085, debug=True) 