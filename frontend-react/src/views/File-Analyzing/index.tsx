import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Card, Flex, Input, Radio, Space, Typography, Upload, message } from 'antd'
import type { UploadProps } from 'antd'
import { InboxOutlined } from '@ant-design/icons'
// ReactMarkdown 用于将 Markdown 格式的文本渲染成漂亮的 HTML
import ReactMarkdown from 'react-markdown'
// remarkGfm 支持 GitHub 风格的 Markdown (表格、删除线等)
import remarkGfm from 'remark-gfm'
// 引入 lodash 的 debounce，用于防抖处理
import debounce from 'lodash/debounce'

// 引入 Redux 相关的钩子，用于在全局状态中存取数据
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { setSelectedFile, uploadPointCloudThunk } from '@/store/pointCloudSlice'

const { Title, Text } = Typography

// --- 功能说明 ---
// 本组件用于“文件语义分析（SSE 实时吐字）”功能。
// 流程：
// 1. 用户选择 .ply 点云文件。
// 2. 上传到后端 /api/upload，后端保存并返回 filename。
// 3. 前端拿到 filename 后，建立 SSE 连接 (/api/llm/stream_file) 请求大模型分析。
// 4. 分析结果流式显示，并支持下载。

type Lang = 'zh' | 'en' // 定义语言类型：中文或英文

const MAX_SIZE_BYTES = 400 * 1024 * 1024 // 400MB

// 获取后端 API 地址，优先使用环境变量，否则默认为 localhost:8085
const baseURL: string = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8085'

const FileAnalyzing: React.FC = () => {
  // dispatch 用于触发 Redux 的动作（如上传文件）
  const dispatch = useAppDispatch()
  // 从 Redux 全局状态中获取当前选中的文件、上传状态等信息
  const { selectedFile, uploaded, uploading } = useAppSelector(s => s.pointCloud)

  // --- 本地状态管理 (State) ---

  // serverFilename: 记录文件上传到服务器后，服务器返回的文件名（用于后续请求分析）
  const [serverFilename, setServerFilename] = useState<string>('')

  // localFile: 记录用户最初在电脑上选中的那个文件对象（主要用于导出时保留原始文件名）
  const [localFile, setLocalFile] = useState<File | null>(null)

  // apiKey: 用户的 OpenAI API Key。
  // 为了安全，使用 lazy initialization (() => ...) 从 localStorage 读取，刷新页面后还在。
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('fileAnalyzingApiKey') || '')

  // lang: 用户选择的分析语言，默认中文 'zh'
  const [lang, setLang] = useState<Lang>('zh')

  // analysisText: 存储大模型实时返回的分析文本。随着流式数据的到来，这个字符串会越来越长。
  // 这里的 analysisText 是“事实源头”，即累积的全量文本。
  const [analysisText, setAnalysisText] = useState<string>('')

  // displayAnalysisText: 用于 UI 渲染的文本状态。它是 analysisText 的“防抖副本”。
  // 通过防抖更新这个状态，可以减少 ReactMarkdown 的重绘频率，从而避免高频更新导致的 UI 闪烁。
  const [displayAnalysisText, setDisplayAnalysisText] = useState<string>('')

  // analyzing: 标记当前是否正在分析中。如果是，会禁用一些按钮，防止重复操作。
  const [analyzing, setAnalyzing] = useState<boolean>(false)

  // eventSourceRef: 使用 useRef 保存 SSE 连接对象的引用。
  // useRef 的特点是：值改变不会触发组件重新渲染，且值在组件生命周期内保持不变，适合存定时器ID、连接对象等。
  const eventSourceRef = useRef<EventSource | null>(null)

  // --- 防抖更新逻辑 ---

  // 创建一个防抖函数，用于延迟更新 UI 上的文本
  // 这里设置为 50ms，即每 50ms 最多更新一次 UI，这样人眼感觉不到卡顿，但能极大减轻渲染压力和闪烁
  // 使用 useCallback 和 useRef 结合确保 debounce 函数在组件生命周期内稳定
  const debouncedUpdateUI = useMemo(
    () =>
      debounce((text: string) => {
        setDisplayAnalysisText(text)
      }, 50),
    []
  )

  // 当 analysisText (数据源) 变化时，触发防抖更新 UI
  useEffect(() => {
    debouncedUpdateUI(analysisText)
    // 清理函数：组件卸载或 analysisText 变化前取消未执行的 debounce
    return () => {
      debouncedUpdateUI.cancel()
    }
  }, [analysisText, debouncedUpdateUI])

  // --- 第一步 上传逻辑 ---

  // beforeUpload: Ant Design Upload 组件的回调。
  // 在文件真正上传前执行，用于校验文件格式和大小。
  // 返回 false 表示“不要自动上传”，因为我们要手动控制上传时机。
  const beforeUpload: UploadProps['beforeUpload'] = useCallback((file: File) => {
    // 1. 检查文件后缀是否为 .ply
    const isPly = file.name.toLowerCase().endsWith('.ply')
    if (!isPly) {
      message.warning('仅支持 .ply 文件')
      return Upload.LIST_IGNORE // 不将非法文件加入列表
    }
    // 2. 检查文件大小
    if (file.size > MAX_SIZE_BYTES) {
      message.warning('文件大小不能超过 100MB')
      return Upload.LIST_IGNORE
    }
    // 3. 校验通过，保存到 Redux 和本地状态
    // 受控：只记录所选文件，不自动上传
    dispatch(setSelectedFile(file))
    // 供 JSON 导出记录原始名
    setLocalFile(file)
    return false // 阻止 Antd 自动上传
  }, [dispatch])

  // onUpload: 点击“上传”按钮时触发
  const onUpload = useCallback(async () => {
    if (!selectedFile) {
      message.info('请先选择 .ply 文件')
      return
    }
    try {
      // 走与 Home 相同的 thunk 上传流程
      // unwrap() 用于直接获取 Promise 成功的结果或抛出错误
      const res = await dispatch(uploadPointCloudThunk(selectedFile)).unwrap()
      // 如果上传成功，后端会返回一个 filename，记下来用于后续分析
      if (res?.filename) {
        setServerFilename(res.filename)
        message.success(`上传成功：${res.filename}`)
      }
    } catch (e) {
      // 失败提示由拦截器或 thunk 内部统一处理
    }
  }, [dispatch, selectedFile])

  // --- 第二步 分析逻辑 (核心) ---

  // 开始分析（建立 SSE 连接）
  const handleStart = useCallback(() => {
    // 1. 确定要分析哪个文件（优先用刚上传的 serverFilename）
    const filename = serverFilename || uploaded?.filename || ''
    if (!filename) {
      message.warning('请先上传 .ply 文件')
      return
    }
    // 2. 校验 API Key
    const trimmedKey = apiKey.trim()
    if (!trimmedKey) {
      message.warning('请先输入 OpenAI API Key')
      return
    }
    // 3. 准备工作：清空上一次的文本
    setAnalysisText('')
    setDisplayAnalysisText('') // 同时清空 UI 显示

    // 4. 组装 SSE URL（GET）：/api/llm/stream_file?filename=...&lang=zh|en&api_key=...
    const url = `${baseURL}/api/llm/stream_file?filename=${encodeURIComponent(filename)}&lang=${encodeURIComponent(lang)}&api_key=${encodeURIComponent(trimmedKey)}`

    // 5. 创建 EventSource 连接（服务端需返回 text/event-stream）
    const es = new EventSource(url)
    eventSourceRef.current = es
    setAnalyzing(true)

    // 6. 监听自定义事件名 delta（后端会使用 event: delta 推送片段）
    es.addEventListener('delta', (e: MessageEvent) => {
      const data = (e as MessageEvent).data || ''
      // 累积文本到数据源 analysisText
      // 注意：这里只更新数据源，不直接触发重绘，重绘交给上面的 useEffect + debounce 托管
      setAnalysisText(prev => prev + data)
    })

    // 7. 自定义完成事件
    es.addEventListener('done', () => {
      setAnalyzing(false)
      es.close()
      eventSourceRef.current = null
      // 确保最后一点内容能显示出来（立即执行一次 debounce）
      debouncedUpdateUI.flush()
    })

    // 8. 错误处理
    es.onerror = () => {
      setAnalyzing(false)
      es.close()
      eventSourceRef.current = null
      message.error('分析过程中发生错误或连接断开')
    }
  }, [serverFilename, uploaded?.filename, lang, apiKey, debouncedUpdateUI])

  // 停止分析（主动断开 SSE）
  const handleStop = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setAnalyzing(false)
    debouncedUpdateUI.flush() // 停止时立即刷新显示
  }, [debouncedUpdateUI])

  // --- 导出/下载逻辑 ---

  // 导出为 TXT（将已累积的 analysisText 作为纯文本下载）
  const handleDownloadTxt = useCallback(() => {
    if (!analysisText) {
      message.warning('暂无可下载内容')
      return
    }
    const blob = new Blob([analysisText], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    // 文件名处理：去掉后缀，加上 .analysis.txt
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

  // --- 副作用与工具函数 ---

  // 组件卸载时，确保关闭 SSE 并清理 debounce
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      debouncedUpdateUI.cancel()
    }
  }, [debouncedUpdateUI])

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
  // 注意：这里依赖的是 displayAnalysisText (防抖后的文本)，而不是 analysisText
  const normalizedMarkdown = useMemo(() => {
    if (!displayAnalysisText) return ''
    return displayAnalysisText
      // 确保标题前有空行
      .replace(/(\S)(###\s?)/g, '$1\n\n$2')
      // 确保列表项前有换行
      .replace(/([^\n])(-\s)/g, '$1\n$2')
      // 去除多余空格导致的高亮
      .replace(/：\s+/g, '： ')
  }, [displayAnalysisText])

  // --- 界面渲染 ---
  return (
    <Space direction='vertical' size='large' style={{ display: 'flex' }}>
      <Title level={3}>Point Cloud File Analyzing</Title>

      <Card>
        <Space direction='vertical' size='middle' style={{ display: 'flex' }}>
          <Text>1. Select .ply File (≤ 400MB)</Text>
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
            <Button icon={<InboxOutlined />}>Select .ply File (≤ 400MB)</Button>
          </Upload>
          <Button type='primary' onClick={onUpload} loading={uploading} disabled={!selectedFile}>
            Upload
          </Button>
          {!!(serverFilename || uploaded?.filename) && (
            <Text type='secondary'>Server Filename：{serverFilename || uploaded?.filename}</Text>
          )}
        </Space>
      </Card>

      <Card>
        <Space direction='vertical' size='middle' style={{ display: 'flex' }}>
          <Text>2. Input OpenAI API Key、Select Output Language, and Start/Stop Analysis</Text>
          <Text type='secondary'>100% Safe! API Key is only stored in the current browser's localStorage, and the backend will not store it.</Text>
          <Text type='secondary'>I provide my own API Key in my Report. Please set it up here.</Text>
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
              <Radio.Button value='en'>English</Radio.Button>
              <Radio.Button value='zh'>中文</Radio.Button>
            </Radio.Group>

            <Button
              type='primary'
              onClick={handleStart}
              disabled={analyzing || !(serverFilename || uploaded?.filename)}
            >
              Start Analysis
            </Button>
            <Button danger onClick={handleStop} disabled={!analyzing}>
              Stop Analysis
            </Button>
          </Flex>

          <Text>3. Streaming Analysis Output (Markdown Format) in Real-Time:</Text>
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
            {/* --- 实时分析输出渲染逻辑 --- */}
            {displayAnalysisText ? (
              // 如果 displayAnalysisText 不为空（说明 SSE 已经返回了内容），则使用 ReactMarkdown 组件渲染
              // ReactMarkdown 将 Markdown 语法（如 ### 标题、- 列表）转换成 HTML
              // remarkPlugins={[remarkGfm]} 支持 GitHub 风格的 Markdown（如表格）
              // normalizedMarkdown 是经过格式修正的文本，避免渲染格式错乱
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{normalizedMarkdown}</ReactMarkdown>
            ) : (
              // 如果 displayAnalysisText 为空（还没开始或者刚开始还没收到字），显示占位提示文本
              <Text type='secondary'>Waiting for analysis result streaming output...</Text>
            )}
          </div>
        </Space>
      </Card>

      <Card>
        <Space direction='vertical'>
          <Space wrap>
            <Button onClick={handleDownloadTxt} disabled={!analysisText || analyzing}>Download Analysis Output TXT</Button>
            <Button onClick={handleDownloadJson} disabled={!analysisText || analyzing}>Download Analysis Output JSON</Button>
            <Button
              onClick={handleDownloadSummary}
              disabled={analyzing || !(serverFilename || uploaded?.filename)}
            >
              Download Point Cloud Summary JSON
            </Button>
          </Space>
          <Text type='secondary'>Point Cloud Summary JSON is generated by the backend and cached, and can be used independently for archiving or other analysis tasks.</Text>
        </Space>
      </Card>

      <Card>
        <Space direction='vertical' size='small'>
          <Text type='secondary'>
            Note: This page will first upload the .ply file to the backend and then establish an SSE long connection to request the large model for text analysis; supports Chinese or English output;
            After the analysis is completed, the full text can be saved as a TXT or JSON file to the local.
          </Text>
        </Space>
      </Card>
    </Space>
  )
}

export default FileAnalyzing
