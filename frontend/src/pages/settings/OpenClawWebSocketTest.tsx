import React, { useState } from 'react';
import { useOpenClawStore } from '../../stores/openclaw';
import { useAgentStore } from '../../stores/agent';

export const OpenClawWebSocketTest: React.FC = () => {
  const [status, setStatus] = useState<string>('未连接');
  const [messages, setMessages] = useState<string[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const { config } = useOpenClawStore();
  const [agentsList, setAgentsList] = useState<any[]>([]);

  const connect = () => {
    try {
      setStatus('正在连接...');
      addMessage('开始连接 OpenClaw Gateway...');
      
      // 使用 Vite 代理连接到 OpenClaw (使用相对路径)
      const socket = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/openclaw-ws`);
      
      socket.onopen = () => {
        console.log('WebSocket 连接成功');
        setStatus('连接成功，等待认证...');
        addMessage('WebSocket 连接已建立，等待服务器认证挑战...');
      };
      
      socket.onmessage = (event) => {
        console.log('收到消息:', event.data);
        addMessage(`收到: ${event.data}`);
        
        // 解析消息
        try {
          const data = JSON.parse(event.data);
          handleMessage(socket, data);
        } catch (e) {
          addMessage(`解析失败: ${event.data}`);
        }
      };
      
      socket.onerror = (error) => {
        console.error('WebSocket 错误:', error);
        setStatus('连接错误');
        addMessage(`错误: ${JSON.stringify(error)}`);
      };
      
      socket.onclose = (event) => {
        console.log('WebSocket 连接关闭', event.code, event.reason);
        setStatus('已断开');
        addMessage(`连接已关闭 (code: ${event.code}, reason: ${event.reason || '无'})`);
        setWs(null);
      };
      
      setWs(socket);
    } catch (error) {
      console.error('连接失败:', error);
      setStatus('连接失败');
      addMessage(`连接失败: ${error}`);
    }
  };

  // 处理收到的消息
  const handleMessage = (socket: WebSocket, data: any) => {
    // 处理认证成功响应
    if (data.type === 'res' && data.id?.startsWith('connect-') && data.ok) {
      addMessage(`[认证成功] 已连接到 OpenClaw Gateway`);
      setStatus('认证成功！');
    }
    
    // 处理认证失败响应
    if (data.type === 'res' && data.id?.startsWith('connect-') && !data.ok) {
      addMessage(`[认证失败] ${data.error?.message || '未知错误'}`);
      setStatus('认证失败');
    }
    
    // 处理health事件 - 包含Agents列表
    if (data.type === 'event' && data.event === 'health' && data.payload) {
      addMessage(`[健康检查] OK - 收到 Agents 列表`);

      if (data.payload.agents && Array.isArray(data.payload.agents)) {
        const agentCount = data.payload.agents.length;
        addMessage(`发现 ${agentCount} 个 Agents`);

        // 更新 Agents 列表状态
        setAgentsList(data.payload.agents);

        // 显示Agents列表
        data.payload.agents.forEach((agent: any) => {
          addMessage(`  - ${agent.name || agent.agentId}`);
        });
      }
    }

    // 处理agents.list响应
    if (data.type === 'res' && data.id?.startsWith('agents-list-') && data.ok) {
      addMessage(`[Agents列表] 获取成功`);

      if (data.payload && Array.isArray(data.payload)) {
        const agentCount = data.payload.length;
        addMessage(`收到 ${agentCount} 个 Agents`);

        // 更新 Agents 列表状态
        setAgentsList(data.payload);

        data.payload.forEach((agent: any) => {
          addMessage(`  - ${agent.name || agent.agentId}`);
        });
      }
    }

    // 处理agent.info响应 - 获取单个Agent详细信息
    if (data.type === 'res' && data.id?.startsWith('agent-info-') && data.ok) {
      addMessage(`[Agent详情] 获取成功`);
      addMessage(`详细信息: ${JSON.stringify(data.payload).substring(0, 200)}...`);
    }

    // 处理其他事件
    if (data.type === 'event') {
      handleEvent(socket, data);
    }
  };

  // 处理事件消息
  const handleEvent = (socket: WebSocket, data: any) => {
    switch (data.event) {
      case 'connect.challenge':
        addMessage(`收到连接挑战: nonce=${data.payload?.nonce}`);
        handleChallenge(socket, data.payload);
        break;
      case 'agent.list':
        addMessage(`收到 Agents 列表: ${JSON.stringify(data.payload)}`);
        break;
      case 'agent.created':
        addMessage(`Agent 创建成功: ${JSON.stringify(data.payload)}`);
        break;
      case 'agent.updated':
        addMessage(`Agent 更新成功: ${JSON.stringify(data.payload)}`);
        break;
      case 'agent.deleted':
        addMessage(`Agent 删除成功: ${JSON.stringify(data.payload)}`);
        break;
      default:
        addMessage(`[event.${data.event}]: ${JSON.stringify(data.payload)}`);
    }
  };

  // 处理连接挑战 - 实现 OpenClaw 认证协议
  const handleChallenge = async (socket: WebSocket, payload: any) => {
    const token = config.gatewayToken || '26237ab3b10049e66250ad2cc4019528c22964788288004f';
    const nonce = payload?.nonce;
    const ts = payload?.ts || Date.now();

    if (!nonce) {
      addMessage('错误: 未收到 nonce');
      return;
    }

    addMessage(`收到 nonce: ${nonce}, ts: ${ts}`);

    // 构建完整的认证请求格式（根据 OpenClaw 官方文档）
    const authRequest = {
      type: 'req',
      id: 'connect-' + Date.now(),
      method: 'connect',
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: 'gateway-client',
          displayName: 'TeamMate AI',
          version: 'dev',
          platform: 'win32',
          mode: 'backend'
        },
        role: 'operator',
        scopes: ['operator.read', 'operator.write'],
        caps: [],
        commands: [],
        permissions: {},
        auth: {
          token: token
        },
        locale: 'zh-CN',
        userAgent: 'TeamilyAI/1.0.0'
      }
    };

    addMessage(`发送完整认证请求...`);
    addMessage(`认证请求: ${JSON.stringify(authRequest)}`);
    socket.send(JSON.stringify(authRequest));

    // 3秒后请求Agents列表
    setTimeout(() => {
      if (socket.readyState === WebSocket.OPEN) {
        addMessage(`请求 Agents 列表...`);
        socket.send(JSON.stringify({
          type: 'req',
          id: 'agents-list-' + Date.now(),
          method: 'agents.list',
          params: {}
        }));
      }
    }, 3000);
  };

  // 简单的 HMAC-SHA256 实现 (用于浏览器环境)
  const simpleHmacSha256 = async (key: string, message: string): Promise<string> => {
    const encoder = new TextEncoder();
    
    // 将 key 和 message 转换为 ArrayBuffer
    const keyData = encoder.encode(key);
    const messageData = encoder.encode(message);
    
    // 导入 HMAC-SHA256 算法
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    // 计算签名
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    
    // 转换为十六进制字符串
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  // 获取 Agents 列表
  const getAgents = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      addMessage('请求 Agents 列表...');
      ws.send(JSON.stringify({
        type: 'agents.list'
      }));
    } else {
      addMessage('错误: 未连接到 OpenClaw');
    }
  };

  const disconnect = () => {
    if (ws) {
      ws.close();
      setWs(null);
    }
  };

  const sendMessage = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const message = {
        type: 'ping'
      };
      ws.send(JSON.stringify(message));
      addMessage(`发送: ${JSON.stringify(message)}`);
    }
  };

  // 获取 Agent 详细信息
  const getAgentInfo = (agentId: string) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      addMessage(`获取 Agent ${agentId} 的详细信息...`);
      ws.send(JSON.stringify({
        type: 'req',
        id: `agent-info-${Date.now()}`,
        method: 'agent.info',
        params: { agentId: agentId }
      }));
    } else {
      addMessage('错误: 未连接到 OpenClaw');
    }
  };

  // 导入 Agents 到系统
  const importAgents = async () => {
    if (agentsList.length === 0) {
      addMessage('错误: 没有可导入的 Agents');
      return;
    }

    try {
      const store = useAgentStore.getState();

      // 生成基于岗位的人格提示词
      const generateSystemPrompt = (role: string): string => {
        const prompts: { [key: string]: string } = {
          'salesforce-architect': '你是一名专业的Salesforce架构师，精通Salesforce平台的设计和开发，能够提供架构设计、最佳实践和技术解决方案。',
          'technical-artist': '你是一名技术艺术家，擅长将艺术创意与技术实现相结合，能够解决游戏和动画中的技术艺术问题。',
          'china-market-localization-strategist': '你是一名中国市场本地化策略专家，熟悉中国市场的文化特点和消费习惯，能够为产品和服务提供本地化建议。',
          'korean-business-navigator': '你是一名韩国商务导航专家，了解韩国商业文化和市场环境，能够为企业提供进入韩国市场的战略建议。',
          'level-designer': '你是一名关卡设计师，擅长设计游戏关卡和游戏体验，能够创造有趣且富有挑战性的游戏内容。'
        };
        
        return prompts[role] || `你是一名${role}，专业、友好，能够提供准确的信息和帮助。`;
      };

      // 转换 OpenClaw Agent 格式为系统格式
      const convertedAgents = agentsList.map((ocAgent: any) => {
        const agentName = ocAgent.name || ocAgent.agentId;
        const role = agentName; // 岗位字段使用姓名字段的值
        const systemPrompt = generateSystemPrompt(role);
        
        return {
          id: ocAgent.agentId,
          name: agentName,
          role: role, // 岗位字段使用姓名字段的值
          description: `从 OpenClaw 导入的 Agent: ${ocAgent.agentId}`,
          model: 'gpt-4',
          provider: 'openai',
          systemPrompt: systemPrompt,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          openclawAgentId: ocAgent.agentId,
          openclawData: ocAgent
        };
      });

      // 使用与创建员工相同的方式导入（调用 createAgent API）
      let importedCount = 0;
      
      for (const agentData of convertedAgents) {
        try {
          const createdAgent = await store.createAgent({
            name: agentData.name,
            role: agentData.role,
            systemPrompt: agentData.systemPrompt,
            avatar: agentData.avatar || '🤖',
            workspaceId: '', // 默认为空，使用系统默认工作区
            knowledgeBaseIds: agentData.knowledgeBaseIds || [],
            customApiKey: agentData.customApiKey || '',
            useCustomApiKey: agentData.useCustomApiKey || false,
            openclawAgentId: agentData.openclawAgentId,
            openclawData: agentData.openclawData
          });
          
          if (createdAgent) {
            importedCount++;
            addMessage(`成功导入 Agent: ${agentData.name}`);
          }
        } catch (error) {
          addMessage(`导入 Agent ${agentData.name} 失败: ${error}`);
        }
      }

      addMessage(`成功导入 ${importedCount} / ${convertedAgents.length} 个 Agents 到系统！`);

      // 提示用户刷新页面查看
      setTimeout(() => {
        alert(`成功导入 ${importedCount} 个 Agents！\n请刷新页面查看更新后的列表。`);
      }, 500);
    } catch (error) {
      addMessage(`导入失败: ${error}`);
    }
  };

  const addMessage = (msg: string) => {
    setMessages(prev => [...prev.slice(-19), msg]);
  };

  return (
    <div className="bg-dark-300 rounded-xl border border-dark-100 p-6">
      <h3 className="text-lg font-medium text-white mb-4">OpenClaw WebSocket 测试</h3>
      
      <div className="space-y-4">
        {/* 状态 */}
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${
            status === '认证成功！' ? 'bg-green-500' : 
            status === '正在连接...' || status === '连接成功，等待认证...' ? 'bg-yellow-500 animate-pulse' :
            status === '认证失败' || status === '连接失败' ? 'bg-red-500' :
            'bg-gray-500'
          }`} />
          <span className="text-white">{status}</span>
        </div>
        
        {/* 当前 Token */}
        <div className="text-xs text-gray-400">
          Token: {config.gatewayToken ? `${config.gatewayToken.substring(0, 8)}...${config.gatewayToken.substring(config.gatewayToken.length - 8)}` : '未设置'}
        </div>
        
        {/* 按钮 */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={connect}
            disabled={ws !== null && ws.readyState === WebSocket.OPEN}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            连接
          </button>
          <button
            onClick={disconnect}
            disabled={ws === null}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            断开
          </button>
          <button
            onClick={getAgents}
            disabled={!ws || ws.readyState !== WebSocket.OPEN}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            获取 Agents 列表
          </button>
          <button
            onClick={sendMessage}
            disabled={!ws || ws.readyState !== WebSocket.OPEN}
            className="px-4 py-2 bg-secondary-600 hover:bg-secondary-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            发送 Ping
          </button>
          <button
            onClick={importAgents}
            disabled={agentsList.length === 0}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            导入 {agentsList.length > 0 ? `(${agentsList.length})` : ''} Agents
          </button>
        </div>
        
        {/* Agents 列表展示 */}
        {agentsList.length > 0 && (
          <div className="bg-dark-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-400 mb-2">OpenClaw Agents：</h4>
            <div className="space-y-2">
              {agentsList.map((agent: any, index: number) => (
                <div key={index} className="text-sm text-gray-300 border-b border-dark-100 pb-2">
                  <div className="font-medium">{agent.name || agent.agentId}</div>
                  <div className="text-xs text-gray-500">
                    ID: {agent.agentId} | 会话: {agent.sessions?.count || 0}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* 消息日志 */}
        <div className="bg-dark-200 rounded-lg p-4 max-h-64 overflow-y-auto">
          <h4 className="text-sm font-medium text-gray-400 mb-2">消息日志：</h4>
          {messages.length === 0 ? (
            <p className="text-sm text-gray-500">暂无消息</p>
          ) : (
            <div className="space-y-1">
              {messages.map((msg, index) => (
                <div key={index} className="text-xs text-gray-300 font-mono break-all">
                  {msg}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
