from flask import Flask, jsonify, send_file, request
from flask_cors import CORS
import numpy as np
import os
import plyfile
import time

app = Flask(__name__)
CORS(app)

# 点云文件目录
POINT_CLOUD_DIR = "../point_cloud"

# 获取PLY文件信息
def get_ply_info(ply_path):
    file_stat = os.stat(ply_path)
    return {
        "name": os.path.basename(ply_path),
        "size": file_stat.st_size,
        "modified": time.ctime(file_stat.st_mtime)
    }

# 读取PLY文件
def read_ply_file(file_path, max_points=10000000):
    try:
        ply_data = plyfile.PlyData.read(file_path)
        
        # 获取点云数据
        vertex = ply_data['vertex']
        
        # 提取坐标
        x = vertex['x']
        y = vertex['y']
        z = vertex['z']
        
        # 如果点云太大，进行下采样
        total_points = len(x)
        if total_points > max_points:
            # 计算采样间隔
            step = total_points // max_points
            x = x[::step]
            y = y[::step]
            z = z[::step]
        
        # 创建点云数据
        points = [[float(x[i]), float(y[i]), float(z[i])] for i in range(len(x))]
        
        result = {
            "points": points,
            "total_points": total_points,
            "loaded_points": len(points)
        }
        
        # 检查是否有颜色数据
        try:
            if hasattr(vertex.dtype, 'names') and all(attr in vertex.dtype.names for attr in ['red', 'green', 'blue']):
                # 如果点云太大且有颜色数据，也进行下采样
                if total_points > max_points:
                    red = vertex['red'][::step]
                    green = vertex['green'][::step]
                    blue = vertex['blue'][::step]
                else:
                    red = vertex['red']
                    green = vertex['green']
                    blue = vertex['blue']
                
                colors = [[int(red[i]), int(green[i]), int(blue[i])] for i in range(len(red))]
                result["colors"] = colors
        except Exception as color_error:
            print(f"注意：无法读取颜色数据: {color_error}")
            # 继续执行，但不包含颜色数据
        
        return result
    
    except Exception as e:
        print(f"Error reading PLY file: {e}")
        return None

# 获取所有点云文件列表
@app.route('/api/point-clouds', methods=['GET'])
def get_point_clouds():
    try:
        files = []
        for filename in os.listdir(POINT_CLOUD_DIR):
            if filename.endswith('.ply'):
                file_path = os.path.join(POINT_CLOUD_DIR, filename)
                files.append(get_ply_info(file_path))
        return jsonify({"point_clouds": files})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# 获取指定点云文件的数据
@app.route('/api/point-clouds/<filename>', methods=['GET'])
def get_point_cloud(filename):
    try:
        # 解析参数
        max_points = request.args.get('max_points', default=100000, type=int)
        
        file_path = os.path.join(POINT_CLOUD_DIR, filename)
        if not os.path.exists(file_path):
            return jsonify({"error": "File not found"}), 404
        
        result = read_ply_file(file_path, max_points)
        if result:
            return jsonify(result)
        else:
            return jsonify({"error": "Failed to read PLY file"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# 专门为加载CUHK_UPPER_ds.ply文件创建的路由
@app.route('/api/cuhk-upper', methods=['GET'])
def get_cuhk_upper():
    try:
        # 解析参数
        max_points = request.args.get('max_points', default=50000000, type=int)
        
        file_path = os.path.join(POINT_CLOUD_DIR, "CUHK_UPPER_ds.ply")
        if not os.path.exists(file_path):
            return jsonify({"error": "CUHK_UPPER_ds.ply not found"}), 404
        
        result = read_ply_file(file_path, max_points)
        if result:
            return jsonify(result)
        else:
            return jsonify({"error": "Failed to read CUHK_UPPER_ds.ply file"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=8085)