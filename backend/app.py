from flask import Flask, jsonify, send_file
from flask_cors import CORS
import numpy as np
import json
import os

app = Flask(__name__)
CORS(app)

# 数据生成函数
def generate_cube_points(size=1.0, points_per_side=10):
    points = []
    # 生成立方体的点
    for x in np.linspace(-size/2, size/2, points_per_side):
        for y in np.linspace(-size/2, size/2, points_per_side):
            for z in np.linspace(-size/2, size/2, points_per_side):
                points.append([float(x), float(y), float(z)])
    return points

def generate_sphere_points(radius=1.0, num_points=1000):
    # 生成球体的点
    phi = np.random.uniform(0, 2*np.pi, num_points)
    theta = np.random.uniform(0, np.pi, num_points)
    
    x = radius * np.sin(theta) * np.cos(phi)
    y = radius * np.sin(theta) * np.sin(phi)
    z = radius * np.cos(theta)
    
    return [[float(x[i]), float(y[i]), float(z[i])] for i in range(num_points)]

# 初始化示例数据
def init_sample_data():
    sample_data = {
        "scenes": {
            "cube": {
                "name": "立方体",
                "points": generate_cube_points(size=2.0, points_per_side=10),
                "color": "#ff0000"
            },
            "sphere": {
                "name": "球体",
                "points": generate_sphere_points(radius=1.5, num_points=1000),
                "color": "#0000ff"
            }
        }
    }
    
    # 确保数据目录存在
    os.makedirs('data/scenes', exist_ok=True)
    
    # 保存数据到文件
    with open('data/scenes/sample_scenes.json', 'w', encoding='utf-8') as f:
        json.dump(sample_data, f, ensure_ascii=False, indent=2)

# API路由
@app.route('/api/scenes', methods=['GET'])
def get_scenes():
    try:
        with open('data/scenes/sample_scenes.json', 'r', encoding='utf-8') as f:
            return jsonify(json.load(f))
    except FileNotFoundError:
        init_sample_data()
        with open('data/scenes/sample_scenes.json', 'r', encoding='utf-8') as f:
            return jsonify(json.load(f))

if __name__ == '__main__':
    # 确保示例数据存在
    if not os.path.exists('data/scenes/sample_scenes.json'):
        init_sample_data()
    app.run(debug=True)
