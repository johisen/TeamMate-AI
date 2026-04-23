// 检查并更新 localStorage 中的 OpenClaw 配置
const fs = require('fs');
const path = require('path');

// 模拟 localStorage
const localStorage = {
  data: {},
  getItem(key) {
    return this.data[key] || null;
  },
  setItem(key, value) {
    this.data[key] = value;
  },
  removeItem(key) {
    delete this.data[key];
  }
};

// 检查当前配置
try {
  // 读取可能存在的 localStorage 模拟文件
  const storagePath = path.join(__dirname, 'localStorage.json');
  if (fs.existsSync(storagePath)) {
    const storageData = JSON.parse(fs.readFileSync(storagePath, 'utf8'));
    localStorage.data = storageData;
  }
  
  const openclawConfig = localStorage.getItem('openclaw-config');
  console.log('Current OpenClaw config:', openclawConfig);
  
  if (openclawConfig) {
    const parsedConfig = JSON.parse(openclawConfig);
    console.log('Parsed config:', parsedConfig);
    
    // 检查是否使用了旧的 3000 端口
    if (parsedConfig.gatewayUrl && parsedConfig.gatewayUrl.includes('3000')) {
      console.log('Found old port 3000 in config, updating to 10099');
      parsedConfig.gatewayUrl = parsedConfig.gatewayUrl.replace('3000', '10099');
      localStorage.setItem('openclaw-config', JSON.stringify(parsedConfig));
      console.log('Updated config:', parsedConfig);
    } else {
      console.log('Config already uses correct port or no port specified');
    }
  } else {
    console.log('No OpenClaw config found in localStorage');
  }
  
  // 保存更新后的 localStorage
  fs.writeFileSync(storagePath, JSON.stringify(localStorage.data, null, 2));
  console.log('LocalStorage saved to', storagePath);
  
} catch (error) {
  console.error('Error:', error);
}
