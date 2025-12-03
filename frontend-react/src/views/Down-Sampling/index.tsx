import React, { useCallback, useState } from 'react'
import { Button, Card, Flex, InputNumber, Space, Typography, Upload, message } from 'antd'
import type { UploadProps } from 'antd'
import { CloudUploadOutlined, DownloadOutlined } from '@ant-design/icons'
import { downsamplePointCloud } from '@/apis/pointCloud'

// 降采样页面：
// 功能：
// 1) 选择 .ply 文件
// 2) 输入自定义保留比例 keepRatio（0.01 ~ 1.0）
// 3) 调用后端 /api/downsample，返回二进制并触发浏览器下载

const MAX_SIZE_BYTES = 1024 * 1024 * 1024 // 1GB

const DownSampling: React.FC = () => {
  const [file, setFile] = useState<File | null>(null)
  const [keepRatio, setKeepRatio] = useState<number>(0.5)
  const [loading, setLoading] = useState(false)

  // 选择文件前的校验：仅 .ply 且体积不超过 1GB
  const beforeUpload: UploadProps['beforeUpload'] = useCallback((f: File) => {
    const isPly = f.name.toLowerCase().endsWith('.ply')
    if (!isPly) {
      message.warning('只允许上传 .ply 文件')
      return Upload.LIST_IGNORE
    }
    if (f.size > MAX_SIZE_BYTES) {
      message.error('文件不能超过 400MB')
      return Upload.LIST_IGNORE
    }
    setFile(f)
    return false
  }, [])

  // 触发降采样并下载结果
  const onDownsample = useCallback(async () => {
    if (!file) {
      message.info('请先选择 .ply 文件')
      return
    }
    if (keepRatio < 0.01 || keepRatio > 1) {
      message.warning('保留比例需在 0.01 ~ 1.0 之间')
      return
    }
    setLoading(true) // 按钮禁用 + 旋转态，防止重复点击并给用户反馈
    try {
      const blob = await downsamplePointCloud(file, keepRatio)
      // 创建临时链接并触发下载
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const ratioStr = String(keepRatio)
      a.href = url
      a.download = `downsampled_${ratioStr}_${file.name}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      message.success('降采样完成，已开始下载')
    } catch (e) {
      // 错误信息由拦截器统一处理，这里不重复提示
    } finally {
      setLoading(false)
    }
  }, [file, keepRatio])

  return (
    <Space direction="vertical" size="small" style={{ width: '100%' }}>
      <Card size="small" bodyStyle={{ padding: 12 }} title={<Typography.Text strong>Point Cloud Down-Sampling and Download</Typography.Text>}>
        <Flex gap={8} align="center" wrap>
          <Upload
            beforeUpload={beforeUpload}
            maxCount={1}
            fileList={file ? [file as any] : []} // fileList是antd的Upload组件的属性，用于显示已上传的文件
            onRemove={() => {
              setFile(null)
              return true
            }}
            showUploadList={{ showRemoveIcon: true }}
          >
            <Button size="small" icon={<CloudUploadOutlined />}>Select .ply File (≤1GB)</Button>
          </Upload>
          {/* antd的Flex组件等价于一个带 display:flex 的 div*/}
          <Flex align="center" gap={6}>
            <Typography.Text>keep Ratio (0.01 ~ 1.0): </Typography.Text>
            <InputNumber
              min={0.01}
              max={1}
              step={0.01}
              precision={2}
              value={keepRatio}
              onChange={(v) => setKeepRatio(Number(v) || 0.5)}
              style={{ width: 100 }}
            />
          </Flex>

          <Button size="small" type="primary" icon={<DownloadOutlined />} onClick={onDownsample} loading={loading} disabled={!file}>
            Start Down-Sampling and Download
          </Button>
        </Flex>
        {file && (
          <div style={{ marginTop: 8, color: '#888', fontSize: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div>Filename：{file.name}</div>
            <div>Size：{(file.size / (1024 * 1024)).toFixed(2)} MB</div>
            <div>Keep Ratio：{keepRatio}</div>
          </div>
        )}
      </Card>
      <Card size="small" bodyStyle={{ padding: 12 }}>
        <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
          Note for large point cloud
        </Typography.Text>
        <Typography.Paragraph style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>
          • For large point cloud (&gt; 400M points): upload and processing may take a long time
          (≈15 mins for ply file with 3.7B points). Please be patient.
        </Typography.Paragraph>
        <Typography.Paragraph style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>
          • The lower the down-sampling ratio, the faster the processing speed.
        </Typography.Paragraph>
        <Typography.Paragraph style={{ marginBottom: 0, fontSize: 13, color: '#666' }}>
          • Recommended to use 10% retention ratio when processing very large files.
        </Typography.Paragraph>
      </Card>
    </Space>
  )
}

export default DownSampling