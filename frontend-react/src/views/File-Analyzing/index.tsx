import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Card, Flex, Input, Radio, Space, Typography, Upload, message } from 'antd'
import type { UploadProps } from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
// 对齐 Home 页的“上传写法”：使用 Redux 管控文件选择与上传
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { setSelectedFile, uploadPointCloudThunk } from '@/store/pointCloudSlice'

const { Title, Text } = Typography

// 说明：
// - 本组件用于“文件语义分析（SSE 实时吐字）”功能，尽量不修改旧文件，集中在该视图中实现。
// - 约束：仅允许 .ply 文件，且前端限制大小不超过 5MB。
// - 流程：前端选择文件 -> 上传到后端 /api/upload -> 拿到 filename -> 建立 SSE 到 /api/llm/stream_file?filename=...&lang=...
// - 语言：用户选择中文(zh)或英文(en)输出，作为查询参数传给后端。
// - 下载：分析完成后，支持导出为 .txt 或 .json（本地生成，不额外请求后端）。

type Lang = 'zh' | 'en'

const MAX_SIZE_BYTES = 100 * 1024 * 1024 // 10MB

const baseURL: string = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8085'

const FileAnalyzing: React.FC = () => {
  const dispatch = useAppDispatch()
  const { selectedFile, uploaded, uploading } = useAppSelector(s => s.pointCloud)

  // 已上传后的后端文件名（后端保存到 uploads/ 后返回的 filename）
  const [serverFilename, setServerFilename] = useState<string>('')
  // 当前选择的原始文件（用于 JSON 导出中记录原始名和大小等）
  const [localFile, setLocalFile] = useState<File | null>(null)
  // OpenAI API Key（只保存在本地浏览器，避免后端暴露）
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('fileAnalyzingApiKey') || '')
  // 语言选择：中文 zh / 英文 en
  const [lang, setLang] = useState<Lang>('zh')
  // SSE 实时累积的分析文本
  const [analysisText, setAnalysisText] = useState<string>('')
  // 是否处于分析中（SSE 连接存活）
  const [analyzing, setAnalyzing] = useState<boolean>(false)
  // SSE 连接引用，以便停止
  const eventSourceRef = useRef<EventSource | null>(null)

  // 与 Home 一致：使用受控 Upload + 手动“上传”按钮
  const beforeUpload: UploadProps['beforeUpload'] = useCallback((file: File) => {
    const isPly = file.name.toLowerCase().endsWith('.ply')
    if (!isPly) {
      message.warning('仅支持 .ply 文件')
      return Upload.LIST_IGNORE
    }
    if (file.size > MAX_SIZE_BYTES) {
      message.warning('文件大小不能超过 10MB')
      return Upload.LIST_IGNORE
    }
    // 受控：只记录所选文件，不自动上传
    dispatch(setSelectedFile(file))
    // 供 JSON 导出记录原始名
    setLocalFile(file)
    return false
  }, [dispatch])

  const onUpload = useCallback(async () => {
    if (!selectedFile) {
      message.info('请先选择 .ply 文件')
      return
    }
    try {
      // 走与 Home 相同的 thunk 上传流程
      const res = await dispatch(uploadPointCloudThunk(selectedFile)).unwrap()
      if (res?.filename) {
        setServerFilename(res.filename)
        message.success(`上传成功：${res.filename}`)
      }
    } catch (e) {
      // 失败提示由拦截器统一处理
    }
  }, [dispatch, selectedFile])

  // 开始分析（建立 SSE 连接）
  const handleStart = useCallback(() => {
    const filename = serverFilename || uploaded?.filename || ''
    if (!filename) {
      message.warning('请先上传 .ply 文件')
      return
    }
    const trimmedKey = apiKey.trim()
    if (!trimmedKey) {
      message.warning('请先输入 OpenAI API Key')
      return
    }
    // 每次分析前清空上一次的文本
    setAnalysisText('')

    // 组装 SSE URL（GET）：/api/llm/stream_file?filename=...&lang=zh|en&api_key=...
    const url = `${baseURL}/api/llm/stream_file?filename=${encodeURIComponent(filename)}&lang=${encodeURIComponent(lang)}&api_key=${encodeURIComponent(trimmedKey)}`

    // 创建 EventSource 连接（服务端需返回 text/event-stream）
    const es = new EventSource(url)
    eventSourceRef.current = es
    setAnalyzing(true)

    // 监听自定义事件名 delta（后端会使用 event: delta 推送片段）
    es.addEventListener('delta', (e: MessageEvent) => {
      const data = (e as MessageEvent).data || ''
      setAnalysisText(prev => prev + data)
    })

    // 自定义完成事件
    es.addEventListener('done', () => {
      setAnalyzing(false)
      es.close()
      eventSourceRef.current = null
    })

    es.onerror = () => {
      setAnalyzing(false)
      es.close()
      eventSourceRef.current = null
      message.error('分析过程中发生错误或连接断开')
    }
  }, [serverFilename, uploaded?.filename, lang, apiKey])

  // 停止分析（主动断开 SSE）
  const handleStop = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setAnalyzing(false)
  }, [])

  // 导出为 TXT（将已累积的 analysisText 作为纯文本下载）
  const handleDownloadTxt = useCallback(() => {
    if (!analysisText) {
      message.warning('暂无可下载内容')
      return
    }
    const blob = new Blob([analysisText], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    const base = (localFile?.name || serverFilename || 'analysis').replace(/\.[^/.]+$/, '')
    a.download = `${base}.analysis.txt`
    a.href = URL.createObjectURL(blob)
    a.click()
    URL.revokeObjectURL(a.href)
  }, [analysisText, localFile?.name, serverFilename])

  // 导出为 JSON（包含文件信息、语言、生成文本与时间戳等）
  const handleDownloadJson = useCallback(() => {
    if (!analysisText) {
      message.warning('暂无可下载内容')
      return
    }
    const payload = {
      filename: serverFilename || null,
      originalFile: localFile ? { name: localFile.name, size: localFile.size } : null,
      language: lang,
      analysis_text: analysisText,
      created_at: new Date().toISOString()
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
    const a = document.createElement('a')
    const base = (localFile?.name || serverFilename || 'analysis').replace(/\.[^/.]+$/, '')
    a.download = `${base}.analysis.json`
    a.href = URL.createObjectURL(blob)
    a.click()
    URL.revokeObjectURL(a.href)
  }, [analysisText, lang, localFile, serverFilename])

  // 组件卸载时，确保关闭 SSE
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [])

  // 同步 API Key 到 localStorage
  useEffect(() => {
    if (apiKey) {
      localStorage.setItem('fileAnalyzingApiKey', apiKey)
    } else {
      localStorage.removeItem('fileAnalyzingApiKey')
    }
  }, [apiKey])

  // 下载点云摘要 JSON（后端生成并缓存）
  const handleDownloadSummary = useCallback(async () => {
    const filename = serverFilename || uploaded?.filename
    if (!filename) {
      message.warning('请先上传并成功获取文件名')
      return
    }
    try {
      const res = await fetch(`${baseURL}/api/pointcloud/${encodeURIComponent(filename)}/summary`)
      if (!res.ok) {
        throw new Error(`下载失败(${res.status})`)
      }
      const blob = await res.blob()
      const a = document.createElement('a')
      a.download = `${filename}.summary.json`
      a.href = URL.createObjectURL(blob)
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (err: any) {
      message.error(err?.message || '下载摘要失败')
    }
  }, [serverFilename, uploaded?.filename])

  // 将 LLM 返回的原始文本做轻量格式修正，方便 Markdown 渲染
  const normalizedMarkdown = useMemo(() => {
    if (!analysisText) return ''
    return analysisText
      // 确保标题前有空行
      .replace(/(\S)(###\s?)/g, '$1\n\n$2')
      // 确保列表项前有换行
      .replace(/([^\n])(-\s)/g, '$1\n$2')
      // 去除多余空格导致的高亮
      .replace(/：\s+/g, '： ')
  }, [analysisText])

  return (
    <Space direction='vertical' size='large' style={{ display: 'flex' }}>
      <Title level={3}>File Analyzing（点云文件分析）</Title>

      <Card>
        <Space direction='vertical' size='middle' style={{ display: 'flex' }}>
          <Text>1. 选择 .ply 文件（大小 ≤ 100MB）</Text>
          <Upload
            beforeUpload={beforeUpload}
            maxCount={1}
            fileList={selectedFile ? [selectedFile as any] : []}
            onRemove={() => {
              dispatch(setSelectedFile(null))
              return true
            }}
            showUploadList={{ showRemoveIcon: true }}
          >
            <Button icon={<InboxOutlined />}>选择 .ply 文件 (≤100MB)</Button>
          </Upload>
          <Button type='primary' onClick={onUpload} loading={uploading} disabled={!selectedFile}>
            上传
          </Button>
          {!!(serverFilename || uploaded?.filename) && (
            <Text type='secondary'>后端文件名：{serverFilename || uploaded?.filename}</Text>
          )}
        </Space>
      </Card>

      <Card>
        <Space direction='vertical' size='middle' style={{ display: 'flex' }}>
          <Text>2. 输入 OpenAI API Key、选择输出语言，并开始/停止分析</Text>
          <Text type='secondary'>API Key 仅保存在当前浏览器的 localStorage，后端不会存储。</Text>
          <Input.Password
            placeholder='I provide my own API Key in my report. Please set it up here.'
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            disabled={analyzing}
          />
          <Flex align='center' gap={16} wrap='wrap'>
            <Radio.Group
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              disabled={analyzing}
            >
              <Radio.Button value='zh'>中文</Radio.Button>
              <Radio.Button value='en'>English</Radio.Button>
            </Radio.Group>

            <Button
              type='primary'
              onClick={handleStart}
              disabled={analyzing || !(serverFilename || uploaded?.filename)}
            >
              开始分析
            </Button>
            <Button danger onClick={handleStop} disabled={!analyzing}>
              停止
            </Button>
          </Flex>

          <Text>3. 实时分析输出（Markdown 渲染）：</Text>
          <div
            style={{
              maxHeight: 360,
              overflowY: 'auto',
              padding: 16,
              border: '1px solid #e5e5e5',
              borderRadius: 8,
              background: '#fafafa'
            }}
          >
            {analysisText ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{normalizedMarkdown}</ReactMarkdown>
            ) : (
              <Text type='secondary'>等待分析结果流式输出……</Text>
            )}
          </div>
        </Space>
      </Card>

      <Card>
        <Space direction='vertical'>
          <Space wrap>
            <Button onClick={handleDownloadTxt} disabled={!analysisText || analyzing}>下载 分析输出TXT</Button>
            <Button onClick={handleDownloadJson} disabled={!analysisText || analyzing}>下载 分析输出JSON</Button>
            <Button
              onClick={handleDownloadSummary}
              disabled={analyzing || !(serverFilename || uploaded?.filename)}
            >
              下载点云摘要 JSON
            </Button>
          </Space>
          <Text type='secondary'>点云摘要 JSON 由后端生成并缓存，可独立用于归档或其他分析任务。</Text>
        </Space>
      </Card>

      <Card>
        <Space direction='vertical' size='small'>
          <Text type='secondary'>
            说明：本页会先将 .ply 上传到后端保存，然后建立 SSE 长连接请求大模型进行文本分析；支持中文或英文输出；
            分析完成后可将全文保存为 TXT 或 JSON 文件到本地。
          </Text>
        </Space>
      </Card>
    </Space>
  )
}

export default FileAnalyzing