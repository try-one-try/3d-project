from plyfile import PlyData

# 替换为您的文件路径
ply_file = "uploads/great_court.ply"

# 读取PLY文件
plydata = PlyData.read(ply_file)



# 打印元素信息
for element in plydata.elements:
    print(f"\n元素: {element.name} (数量: {len(element)})")
    print("属性:")
    for prop in element.properties:
        print(f"  - {prop.name}: {prop.dtype}")

# 如果有顶点元素，显示前几个样本
if 'vertex' in plydata:
    vertex = plydata['vertex']
    print("\n顶点样本 (前5个):")
    for i in range(min(5, len(vertex))):
        sample = {}
        for prop in vertex.properties:
            sample[prop.name] = vertex[prop.name][i]
        print(f"  样本 {i+1}: {sample}")
