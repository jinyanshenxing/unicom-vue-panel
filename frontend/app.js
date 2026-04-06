var app = new Vue({
    el: '#app',
    data: {
        userInfo: {},
        flowList: [],
        packageList: [],
        activeName: 'first',
        downloadSpeed: '--', // 下行速率
        uploadSpeed: '--',   // 上行速率
        qciLevel: '--',      // QCI等级
        networkType: '--',   // 网络类型
        speedStatus: '正常'  // 限速状态
    },
    created() {
        this.initData();
    },
    methods: {
        async initData() {
            await this.getUserInfo();
            await this.getFlowData();
            await this.getSpeedData(); // 重新加入并修复
            await this.getBizData();
            // 数据加载完毕后手动计算一次使用率
            this.$nextTick(() => {
                this.calcUsageRate();
            });
        },
        
        // 获取用户基础信息
        getUserInfo() {
            return new Promise((resolve) => {
                axios.get('/api/user').then(res => {
                    if (res.code === '0000') {
                        this.userInfo = res.data;
                    }
                    resolve();
                }).catch(() => resolve());
            });
        },
        
        // 🔥 修复后的流量数据获取（完美适配 xcanusevalue/xusedvalue）
        getFlowData() {
            return new Promise((resolve) => {
                axios.get('/api/flow').then(res => {
                    let flowArr = [];
                    // 增加容错判断，确保 res 存在且数据正常
                    if (res && res.code === '0000' && res.data) {
                        const data = res.data;
                        
                        // 处理 flowSumList 流量汇总
                        if (data.flowSumList && Array.isArray(data.flowSumList)) {
                            data.flowSumList.forEach(item => {
                                // 使用 parseFloat 强制转换，防止字符串导致的计算错误
                                let total = parseFloat(item.xcanusevalue || 0);
                                let used = parseFloat(item.xusedvalue || 0);
                                // 确保剩余流量不为负数
                                let remain = Math.max(0, total - used).toFixed(2);

                                let flowName = item.flowtype == 1 ? "通用流量" : "定向流量";
                                
                                flowArr.push({
                                    name: flowName,
                                    total: total.toFixed(2), // 保留两位小数
                                    used: used.toFixed(2),
                                    remain: remain,
                                    unit: "MB"
                                });
                            });
                        }
                    }
                    this.flowList = flowArr;
                    resolve();
                }).catch(() => {
                    this.flowList = [];
                    resolve();
                });
            });
        },
        
        // 🔥 修复后的速率数据获取（剥离 HTML 标签，只取数字）
        getSpeedData() {
            return new Promise((resolve) => {
                axios.get('/api/speed').then(res => {
                    if (res && res.code === '0000') {
                        let desc = res.data.desc || "";
                        // 使用正则表达式提取数字
                        let downMatch = desc.match(/下行峰值速率.*?(\d+(\.\d+)?)/);
                        let upMatch = desc.match(/上行峰值速率.*?(\d+(\.\d+)?)/);
                        
                        // 赋值或保留默认 --
                        this.downloadSpeed = downMatch ? downMatch[1] : '--';
                        this.uploadSpeed = upMatch ? upMatch[1] : '--';
                        
                        // 解析 QCI 与网络类型（根据你日志中的字段调整）
                        this.qciLevel = res.data.qciLevel || '--';
                        this.networkType = res.data.networkType || '5G';
                    }
                    resolve();
                }).catch(() => {
                    this.downloadSpeed = '查询失败';
                    this.uploadSpeed = '查询失败';
                    resolve();
                });
            });
        },
        
        // 获取已订业务
        getBizData() {
            return new Promise((resolve) => {
                axios.get('/api/biz').then(res => {
                    if (res && res.code === '0000') {
                        this.packageList = res.data.mainProductInfo || [];
                    }
                    resolve();
                }).catch(() => {
                    this.packageList = [];
                    resolve();
                });
            });
        },
        
        // 手动计算使用率（防止出现 NaN）
        calcUsageRate() {
            let totalUsed = 0;
            let totalTotal = 0;
            
            this.flowList.forEach(item => {
                totalUsed += parseFloat(item.used || 0);
                totalTotal += parseFloat(item.total || 0);
            });
            
            // 防止除以 0，使用率默认 0%
            let rate = totalTotal > 0 ? (totalUsed / totalTotal) * 100 : 0;
            // 页面上的使用率卡片由原来的自动计算改为这里手动赋值
            document.querySelector('.usage-rate .num').innerText = rate.toFixed(0) + '%';
        },
        
        // 刷新数据
        refreshData() {
            this.flowList = [];
            this.packageList = [];
            this.downloadSpeed = '--';
            this.uploadSpeed = '--';
            this.initData();
        }
    }
});
