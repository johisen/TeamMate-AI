import { create } from 'zustand';
import { OpenClawWsClient } from './openclawWsClient';

interface OpenClawAgent {
  id: string;
  name: string;
  role: string;
  avatar: string;
  systemPrompt: string;
}

interface ConnectionStatus {
  connected: boolean;
  status: string;
  error?: string;
}

interface FullConfig {
  gatewayUrl: string;
  gatewayToken: string;
  useProxy: boolean;
  enabled: boolean;
  lastSyncTime: Date | null;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  syncResult: {
    imported: number;
    failed: number;
    errors: string[];
  };
}

const DEFAULT_URL = 'ws://localhost:10099';
const DEFAULT_TOKEN = '26237ab3b10049e66250ad2cc4019528c22964788288004f';

const SAMPLE_AGENTS: OpenClawAgent[] = [
  {
    id: 'oc-demo-1',
    name: '主要助手',
    role: 'AI助手',
    avatar: '🤖',
    systemPrompt: '你是一位友好的AI助手，可以回答各种问题。'
  },
  {
    id: 'oc-demo-2',
    name: '代码助手',
    role: '程序员',
    avatar: '👨‍💻',
    systemPrompt: '你是一位专业的编程助手，擅长代码开发和技术问题解答。'
  },
  {
    id: 'oc-demo-3',
    name: '设计助手',
    role: '设计师',
    avatar: '🎨',
    systemPrompt: '你是一位创意设计助手，擅长UI/UX设计和创意问题。'
  },
  {
    id: 'oc-demo-4',
    name: '写作助手',
    role: '作家',
    avatar: '✍️',
    systemPrompt: '你是一位专业写作助手，擅长文案创作和内容优化。'
  },
  {
    id: 'oc-demo-5',
    name: '数据分析',
    role: '数据分析师',
    avatar: '📊',
    systemPrompt: '你是一位数据分析助手，擅长数据处理和可视化。'
  }
];

const setStoredConfig = (config: Partial<FullConfig>) => {
  try {
    const toStore = { ...config };
    if (toStore.lastSyncTime) {
      toStore.lastSyncTime = toStore.lastSyncTime.toISOString();
    }
    localStorage.setItem('openclaw-config', JSON.stringify(toStore));
  } catch (e) {
    console.error('Failed to save OpenClaw config:', e);
  }
};

const getStoredConfig = (): Partial<FullConfig> => {
  try {
    const stored = localStorage.getItem('openclaw-config');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.lastSyncTime) {
        parsed.lastSyncTime = new Date(parsed.lastSyncTime);
      }
      return parsed;
    }
  } catch (e) {
    console.error('Failed to load OpenClaw config:', e);
  }
  return {
    gatewayUrl: DEFAULT_URL,
    gatewayToken: DEFAULT_TOKEN,
    useProxy: true,
    enabled: false,
    syncStatus: 'idle',
    syncResult: { imported: 0, failed: 0, errors: [] }
  };
};

interface OpenClawStore {
  config: Partial<FullConfig>;
  connectionStatus: ConnectionStatus;
  availableAgents: OpenClawAgent[];
  wsClient: OpenClawWsClient | null;
  setConfig: (newConfig: Partial<FullConfig>) => void;
  saveConfig: () => void;
  testConnection: () => Promise<boolean>;
  fetchAgents: () => Promise<OpenClawAgent[]>;
  syncFromOpenClaw: () => Promise<void>;
  syncToOpenClaw: () => Promise<void>;
  reset: () => void;
  debugImportDemoAgents: () => void;
  connectWs: () => Promise<boolean>;
  disconnectWs: () => void;
}

export const useOpenClawStore = create<OpenClawStore>((set, get) => {
  const initialConfig = getStoredConfig();
  let wsClient: OpenClawWsClient | null = null;

  const initWsClient = () => {
    const { config } = get();
    if (!wsClient) {
      wsClient = new OpenClawWsClient({
        config,
        onConnected: () => {
          set({
            connectionStatus: { connected: true, status: '已连接' }
          });
        },
        onDisconnected: () => {
          set({
            connectionStatus: { connected: false, status: '已断开' }
          });
        },
        onAgentsUpdated: (agents) => {
          set({ availableAgents: agents });
        },
        onError: (error) => {
          set({
            connectionStatus: { connected: false, status: '连接错误', error }
          });
        },
        onMessage: (message) => {
          console.log('收到 OpenClaw 消息:', message);
        }
      });
    }
    return wsClient;
  };

  return {
    config: initialConfig,
    connectionStatus: { connected: false, status: '未连接' },
    availableAgents: [],
    wsClient: null,

    setConfig: (newConfig: Partial<FullConfig>) => {
      set((state) => ({
        config: { ...state.config, ...newConfig }
      }));
    },

    saveConfig: () => {
      const { config } = get();
      setStoredConfig(config);
    },

    connectWs: async (): Promise<boolean> => {
      const client = initWsClient();
      const connected = await client.connect();
      set({ wsClient: client });
      return connected;
    },

    disconnectWs: () => {
      if (wsClient) {
        wsClient.disconnect();
        wsClient = null;
      }
      set({ wsClient: null });
    },

    testConnection: async (): Promise<boolean> => {
      const { config } = get();
      console.log('测试 OpenClaw 连接...');
      
      set({ connectionStatus: { connected: false, status: '连接中...' } });

      try {
        const client = initWsClient();
        const connected = await client.connect();

        if (connected) {
          set({ 
            wsClient: client,
            connectionStatus: { connected: true, status: '连接成功' } 
          });
          return true;
        } else {
          console.log('WebSocket 连接失败，使用演示模式');
          set({ 
            availableAgents: SAMPLE_AGENTS,
            connectionStatus: { connected: false, status: '演示模式' } 
          });
          return true;
        }
      } catch (error) {
        console.error('连接测试失败，使用演示模式:', error);
        set({ 
          availableAgents: SAMPLE_AGENTS,
          connectionStatus: { connected: false, status: '演示模式' } 
        });
        return true;
      }
    },

    fetchAgents: async (): Promise<OpenClawAgent[]> => {
      console.log('获取 OpenClaw Agents...');
      
      try {
        const client = initWsClient();
        
        if (client.isConnected()) {
          console.log('使用真实 WebSocket 连接');
          const agents = await client.fetchAgents();
          if (agents.length > 0) {
            set({ availableAgents: agents });
            return agents;
          }
        }
        
        console.log('使用演示数据');
        set({ availableAgents: SAMPLE_AGENTS });
        return SAMPLE_AGENTS;
      } catch (error) {
        console.error('获取 Agents 失败，使用演示数据:', error);
        set({ availableAgents: SAMPLE_AGENTS });
        return SAMPLE_AGENTS;
      }
    },

    syncFromOpenClaw: async (): Promise<void> => {
      const { config, availableAgents } = get();
      
      set({ 
        config: { 
          ...config, 
          syncStatus: 'syncing' 
        } 
      });

      try {
        let agents = availableAgents;
        if (agents.length === 0) {
          agents = await get().fetchAgents();
        }

        const { useAgentStore } = await import('./agent');

        const existingAgents = useAgentStore.getState().agents;
        const existingIds = new Set(existingAgents.map(a => a.id));
        const agentsToAdd = agents.filter(a => !existingIds.has(a.id));

        if (agentsToAdd.length > 0) {
          await useAgentStore.getState().bulkAddAgents(
            agentsToAdd.map(a => ({
              ...a,
              isOpenClawNative: true,
              openClawId: a.id,
              customApiKey: null,
              useCustomApiKey: false
            }))
          );
        }

        set({
          config: {
            ...config,
            syncStatus: 'success',
            lastSyncTime: new Date(),
            syncResult: {
              imported: agentsToAdd.length,
              failed: 0,
              errors: []
            }
          }
        });

        get().saveConfig();
        
      } catch (error: any) {
        console.error('从 OpenClaw 同步失败:', error);
        set({
          config: {
            ...config,
            syncStatus: 'error',
            syncResult: {
              imported: 0,
              failed: 1,
              errors: [error?.message || '同步失败']
            }
          }
        });
      }
    },

    syncToOpenClaw: async (): Promise<void> => {
      const { config } = get();
      console.log('同步到 OpenClaw（演示模式）...');
      
      set({ 
        config: { 
          ...config, 
          syncStatus: 'syncing' 
        } 
      });
      
      setTimeout(() => {
        set({
          config: {
            ...config,
            syncStatus: 'success',
            lastSyncTime: new Date(),
            syncResult: {
              imported: 0,
              failed: 0,
              errors: ['此为演示模式，实际同步需要 OpenClaw Gateway API']
            }
          }
        });
      }, 1000);
    },

    reset: () => {
      const defaultConfig = {
        gatewayUrl: DEFAULT_URL,
        gatewayToken: DEFAULT_TOKEN,
        useProxy: true,
        enabled: false,
        syncStatus: 'idle',
        syncResult: { imported: 0, failed: 0, errors: [] }
      };
      set({
        config: defaultConfig,
        connectionStatus: { connected: false, status: '未连接' },
        availableAgents: [],
        wsClient: null
      });
      setStoredConfig(defaultConfig);
      wsClient = null;
    },

    debugImportDemoAgents: () => {
      console.log('调试：导入演示 Agents...');
      
      import('./agent').then(({ useAgentStore }) => {
        const existingAgents = useAgentStore.getState().agents;
        const existingIds = new Set(existingAgents.map(a => a.id));
        const agentsToAdd = SAMPLE_AGENTS.filter(a => !existingIds.has(a.id));

        if (agentsToAdd.length === 0) {
          console.log('所有演示 Agents 已存在');
          return;
        }

        useAgentStore.getState().bulkAddAgents(
          agentsToAdd.map(a => ({
            ...a,
            isOpenClawNative: true,
            openClawId: a.id,
            customApiKey: null,
            useCustomApiKey: false
          }))
        );

        console.log(`成功导入 ${agentsToAdd.length} 个演示 Agents`);
      });
    }
  };
});
