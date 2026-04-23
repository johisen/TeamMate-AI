interface OpenClawAgent {
  id: string;
  name: string;
  role: string;
  avatar: string;
  systemPrompt: string;
  agentId: string;
}

interface OpenClawWsClientOptions {
  config: any;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onAgentsUpdated?: (agents: any[]) => void;
  onError?: (error: string) => void;
  onMessage?: (message: any) => void;
}

export class OpenClawWsClient {
  private ws: WebSocket | null = null;
  private options: OpenClawWsClientOptions;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private isConnecting = false;
  private pendingRequests = new Map<string, (result: any) => void>();
  private agents: Map<string, any> = new Map();

  constructor(options: OpenClawWsClientOptions) {
    this.options = options;
  }

  // 连接到OpenClaw Gateway
  async connect(): Promise<boolean> {
    if (this.isConnecting) {
      console.log('已经在连接中，跳过');
      return false;
    }

    this.isConnecting = true;

    try {
      return await new Promise((resolve) => {
        const wsUrl = this.options.config.useProxy
          ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/openclaw-ws`
          : (this.options.config.gatewayUrl || 'ws://localhost:10099');

        console.log('正在连接到 OpenClaw Gateway:', wsUrl);
        
        this.ws = new WebSocket(wsUrl);

        // 保存 resolve 函数，认证成功后调用
        let connectionResolve: ((value: boolean) => void) | null = resolve;
        
        // 设置超时
        const timeout = setTimeout(() => {
          if (connectionResolve) {
            console.warn('连接超时，使用演示模式');
            connectionResolve(false);
            connectionResolve = null;
          }
        }, 15000);

        this.ws.onopen = () => {
          console.log('WebSocket 连接已打开');
          this.reconnectAttempts = 0;
          this.options.onConnected?.();
          // 连接打开后会先收到 challenge，等待认证
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket 错误:', error);
          this.isConnecting = false;
          this.options.onError?.('连接错误');
          clearTimeout(timeout);
          if (connectionResolve) {
            connectionResolve(false);
            connectionResolve = null;
          }
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket 连接已关闭:', event.code, event.reason);
          this.isConnecting = false;
          this.ws = null;
          this.options.onDisconnected?.();
          clearTimeout(timeout);
          if (connectionResolve) {
            connectionResolve(false);
            connectionResolve = null;
          }
          // 如果连接失败，尝试重连
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            setTimeout(() => this.connect(), this.reconnectDelay);
          }
        };
        
        // 更新连接 resolve 函数
        const originalResolve = resolve;
        this.connectionResolve = (success: boolean) => {
          this.isConnecting = false;
          clearTimeout(timeout);
          if (connectionResolve) {
            connectionResolve(success);
            connectionResolve = null;
          }
        };
      });
    } catch (error) {
      console.error('连接失败:', error);
      this.isConnecting = false;
      this.options.onError?.('连接失败');
      return false;
    }
  }

  private connectionResolve: ((success: boolean) => void) | null = null;

  // 断开连接
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.reconnectAttempts = 0;
  }

  // 处理收到的消息
  private handleMessage = (data: string) => {
    try {
      const message = JSON.parse(data);
      console.log('收到 OpenClaw 消息:', message);
      this.options.onMessage?.(message);

      // 处理连接挑战
      if (message.type === 'event' && message.event === 'connect.challenge') {
        this.handleChallenge(message.payload);
      }

      // 处理健康检查事件
      if (message.type === 'event' && message.event === 'health') {
        console.log('收到 health 事件，payload:', message.payload);
        
        if (message.payload?.agents && Array.isArray(message.payload.agents)) {
          console.log('health 事件包含 agents，数量:', message.payload.agents.length);
          
          // 更新本地 agents Map
          message.payload.agents.forEach((agent: any) => {
            if (agent.agentId) {
              this.agents.set(agent.agentId, agent);
            }
          });
          
          const agents = this.transformOpenClawAgents(Array.from(this.agents.values()));
          this.options.onAgentsUpdated?.(agents);
        }
      }

      // 处理 agent 事件（单个 agent 更新）
      if (message.type === 'event' && message.event === 'agent' && message.payload) {
        this.handleAgentEvent(message.payload);
      }

      // 处理响应
      if (message.type === 'res' && message.id) {
        // 处理连接认证响应
        if (message.id.startsWith('connect-')) {
          if (message.ok) {
            console.log('认证成功！');
            // 认证成功，resolve 连接 Promise
            if (this.connectionResolve) {
              this.connectionResolve(true);
            }
            // 认证成功后，请求 agents 列表
            setTimeout(() => this.fetchAgents(), 500);
          } else {
            console.error('认证失败:', message.error);
            if (this.connectionResolve) {
              this.connectionResolve(false);
            }
          }
        }
        
        // 处理其他 pending 请求
        const callback = this.pendingRequests.get(message.id);
        if (callback) {
          this.pendingRequests.delete(message.id);
          callback(message);
        }
      }
    } catch (error) {
      console.error('解析消息失败:', error);
    }
  }

  // 处理单个 agent 事件
  private handleAgentEvent(agent: any) {
    console.log('处理 agent 事件:', agent);
    
    // 更新本地 agents 列表
    if (agent.agentId) {
      this.agents.set(agent.agentId, agent);
    }
    
    // 转换并更新前端显示
    const agentList = Array.from(this.agents.values());
    const transformedAgents = this.transformOpenClawAgents(agentList);
    this.options.onAgentsUpdated?.(transformedAgents);
  }

  // 处理连接挑战
  private handleChallenge(payload: any) {
    const token = this.options.config.gatewayToken || '26237ab3b10049e66250ad2cc4019528c22964788288004f';
    const nonce = payload?.nonce;

    if (!nonce) {
      console.error('未收到 nonce');
      return;
    }

    console.log('收到连接挑战，发送认证请求');

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
        caps: [],
        commands: [],
        permissions: {},
        auth: { token },
        locale: 'zh-CN',
        userAgent: 'TeamilyAI/1.0.0'
      }
    };

    this.send(authRequest);

    // 认证后，等待接收 agent 事件，不主动请求 agents 列表
    // 因为 agents.list 需要权限，但 agent 事件会主动推送
    console.log('等待接收 agent 事件...');
  }

  // 获取Agents列表（直接返回已收集的 agents）
  async fetchAgents(): Promise<OpenClawAgent[]> {
    console.log('返回已收集的 agents，数量:', this.agents.size);
    
    const agentList = Array.from(this.agents.values());
    const agents = this.transformOpenClawAgents(agentList);
    
    this.options.onAgentsUpdated?.(agents);
    return agents;
  }

  // 获取单个Agent的详细信息
  async getAgentInfo(agentId: string): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket 未连接');
    }

    const requestId = 'agent-info-' + Date.now();

    const request = {
      type: 'req',
      id: requestId,
      method: 'agent.info',
      params: { agentId }
    };

    this.send(request);

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        console.warn('获取Agent详情超时');
        resolve(null);
      }, 10000);

      this.pendingRequests.set(requestId, (response) => {
        clearTimeout(timeout);
        if (response.ok) {
          resolve(response.payload);
        } else {
          console.error('获取Agent详情失败:', response.error);
          resolve(null);
        }
      });
    });
  }

  // 发送消息
  private send(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  // 转换OpenClaw Agent格式为我们的格式
  private transformOpenClawAgents(ocAgents: any[]): OpenClawAgent[] {
    if (!Array.isArray(ocAgents)) {
      console.warn('transformOpenClawAgents: 输入不是数组:', ocAgents);
      return [];
    }
    
    return ocAgents.map((ocAgent) => {
      const agentName = ocAgent.name || ocAgent.agentId || 'Unknown Agent';
      const agentId = ocAgent.agentId || agentName;
      
      return {
        id: agentId,
        name: agentName,
        role: this.extractRole(ocAgent),
        avatar: this.selectAvatar(ocAgent),
        systemPrompt: this.generateSystemPrompt(agentName, ocAgent),
        agentId: agentId
      };
    });
  }

  // 提取角色信息
  private extractRole(ocAgent: any): string {
    if (ocAgent.role) return ocAgent.role;
    if (ocAgent.config?.role) return ocAgent.config.role;
    if (ocAgent.name) return ocAgent.name;
    return 'AI Assistant';
  }

  // 选择合适的头像
  private selectAvatar(ocAgent: any): string {
    const name = (ocAgent.name || ocAgent.agentId || '').toLowerCase();
    
    if (name.includes('code') || name.includes('dev')) return '💻';
    if (name.includes('design')) return '🎨';
    if (name.includes('data')) return '📊';
    if (name.includes('write')) return '✍️';
    if (name.includes('assistant')) return '🤖';
    if (name.includes('manager')) return '📋';
    if (name.includes('analyst')) return '🔍';
    
    return '🤖';
  }

  // 生成系统提示词（更智能）
  private generateSystemPrompt(role: string, ocAgent?: any): string {
    // 尝试使用 OpenClaw agent 的配置
    if (ocAgent?.config?.systemPrompt) {
      return ocAgent.config.systemPrompt;
    }
    if (ocAgent?.systemPrompt) {
      return ocAgent.systemPrompt;
    }
    
    const prompts: { [key: string]: string } = {
      'salesforce-architect': '你是一名专业的Salesforce架构师，精通Salesforce平台的设计和开发，能够提供架构设计、最佳实践和技术解决方案。',
      'technical-artist': '你是一名技术艺术家，擅长将艺术创意与技术实现相结合，能够解决游戏和动画中的技术艺术问题。',
      'china-market-localization-strategist': '你是一名中国市场本地化策略专家，熟悉中国市场的文化特点和消费习惯，能够为产品和服务提供本地化建议。',
      'korean-business-navigator': '你是一名韩国商务导航专家，了解韩国商业文化和市场环境，能够为企业提供进入韩国市场的战略建议。',
      'level-designer': '你是一名关卡设计师，擅长设计游戏关卡和游戏体验，能够创造有趣且富有挑战性的游戏内容。'
    };
    
    const roleLower = role.toLowerCase();
    for (const [key, prompt] of Object.entries(prompts)) {
      if (roleLower.includes(key)) {
        return prompt;
      }
    }
    
    return `你是一名${role}，专业、友好，能够提供准确的信息和帮助。`;
  }



  // 检查是否已连接
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
