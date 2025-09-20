import React, { useCallback, useMemo } from 'react'
import { Button, Card, Flex, Space, Typography, Upload, message } from 'antd'
import { CloudUploadOutlined, PlayCircleOutlined } from '@ant-design/icons'
import type { UploadProps } from 'antd'
import PointCloudViewer, { type PointCloudViewerHandle } from '@/components/PointCloudViewer'
// Redux 相关：选择器与分发器
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { setSelectedFile, uploadPointCloudThunk, fetchPointCloudThunk } from '@/store/pointCloudSlice'

const MAX_SIZE_BYTES = 400 * 1024 * 1024 // 400MB

const Home: React.FC = () => {
  const dispatch = useAppDispatch()
  // 通过 ref 调用 PointCloudViewer 暴露的旋转方法
  const viewerRef = React.useRef<PointCloudViewerHandle | null>(null)
  // 使用类型化的选择器读取点云模块的状态
  const { selectedFile, uploaded, uploading, rendering, viewerData } = useAppSelector((s) => s.pointCloud)

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
    // 使用 Redux 存储当前选择的文件，并清空之前的上传/渲染结果
    dispatch(setSelectedFile(f))
    return false
  }, [dispatch])

  const onUpload = useCallback(async () => {
    if (!selectedFile) {
      message.info('请先选择 .ply 文件')
      return
    }
    // 调用 Redux 异步 Thunk 执行上传
    try {
      const res = await dispatch(uploadPointCloudThunk(selectedFile)).unwrap()
      message.success(`上传成功：${res.filename}（点数：${res.total_points}）`)
    } catch (e) {
      // 失败提示由拦截器统一处理
    }
  }, [dispatch, selectedFile])

  const canRender = useMemo(() => !!uploaded?.filename, [uploaded])

  const onRender = useCallback(async () => {
    if (!uploaded?.filename) {
      message.info('请先上传文件')
      return
    }
    try {
      await dispatch(fetchPointCloudThunk(uploaded.filename)).unwrap()
    } catch (e) {
      // 全局拦截器已有提示
    }
  }, [dispatch, uploaded])

  return (
    <Space direction="vertical" size="small" style={{ width: '100%' }}>
      <Card size="small" bodyStyle={{ padding: 12 }} title={<Typography.Text strong>点云上传与渲染</Typography.Text>}>
        <Flex gap={8} align="center" wrap>
          {/*
            使用 Upload 的受控模式：
            - fileList 来自 Redux 的 selectedFile
            - onRemove 时清空 selectedFile
          */}
          <Upload
            beforeUpload={beforeUpload}
            maxCount={1}
            fileList={selectedFile ? [selectedFile as any] : []}
            onRemove={() => {
              // antd onRemove 需要返回 boolean | void，这里返回 true 允许移除
              dispatch(setSelectedFile(null))
              return true
            }}
            showUploadList={{ showRemoveIcon: true }}
          >
            <Button size="small" icon={<CloudUploadOutlined />}>选择 .ply 文件 (≤400MB)</Button>
          </Upload>
          <Button size="small" type="primary" onClick={onUpload} loading={uploading} disabled={!selectedFile}>
            上传
          </Button>
          <Button size="small" icon={<PlayCircleOutlined />} onClick={onRender} loading={rendering} disabled={!canRender}>
            开始渲染
          </Button>
        </Flex>
        {uploaded && (
          <div style={{ marginTop: 8, color: '#888', fontSize: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div>文件：{uploaded.filename}</div>
            <div>点数：{uploaded.total_points}</div>
            <div>包含颜色：{uploaded.has_colors ? '是' : '否'}</div>
          </div>
        )}
      </Card>

      {viewerData && (
        <div style={{ position: 'relative' }}>
          {/* 渲染区域 */}
          <PointCloudViewer ref={viewerRef} data={viewerData} />

          {/* 方向控制按钮：上/下/左/右 旋转（覆盖在画布上方，始终可见） */}
          <div
            style={{
              position: 'absolute',
              bottom: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10,
              background: 'rgba(0,0,0,0.4)',
              padding: 12,
              borderRadius: 12,
              boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
              backdropFilter: 'blur(4px)'
            }}
          >
            <Flex vertical align="center" justify="center">
              <Button shape="default" size="large" type="primary" ghost onClick={() => viewerRef.current?.rotateUp()}>上</Button>
              <Space style={{ marginTop: 8, marginBottom: 8 }}>
                <Button shape="default" size="large" type="primary" ghost onClick={() => viewerRef.current?.rotateLeft()}>左</Button>
                <Button shape="default" size="large" type="primary" ghost onClick={() => viewerRef.current?.rotateRight()}>右</Button>
              </Space>
              <Button shape="default" size="large" type="primary" ghost onClick={() => viewerRef.current?.rotateDown()}>下</Button>
            </Flex>
          </div>
        </div>
      )}
    </Space>
  )
}

export default Home