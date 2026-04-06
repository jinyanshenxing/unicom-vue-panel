var app = new Vue({
    el: '#app',
    data: {
        userInfo: {},
        flowList: [],
        packageList: [],
        activeName: 'first'
    },
    created() {
        this.initData();
    },
    methods: {
        async initData() {
            await this.getUserInfo();
            await this.getFlowData();
            await this.getBizData();
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
        // 获取流量数据（已完美适配你的接口）
        getFlowData() {
            return new Promise((resolve) => {
                axios.get('/api/flow').then(res => {
                    if (res.code === '0000') {
                        let data = res.data;
                        let flowArr = [];
                        
                        if (data.flowSumList && data.flowSumList.length > 0) {
                            data.flowSumList.forEach(item => {
                                let total = parseFloat(item.xcanusevalue || 0);
                                let used = parseFloat(item.xusedvalue || 0);
                                let remain = total > 0 ? (total - used).toFixed(2) : 0;
                                let flowName = item.flowtype == 1 ? "通用流量" : "定向流量";
                                
                                flowArr.push({
                                    name: flowName,
                                    total: total,
                                    used: used,
                                    remain: remain,
                                    unit: "MB"
                                });
                            });
                        }
                        
                        this.flowList = flowArr;
                    }
                    resolve();
                }).catch(() => resolve());
            });
        },
        // 获取已订业务数据
        getBizData() {
            return new Promise((resolve) => {
                axios.get('/api/biz').then(res => {
                    if (res.code === '0000') {
                        this.packageList = res.data.mainProductInfo || [];
                    }
                    resolve();
                }).catch(() => resolve());
            });
        },
        // 刷新数据
        refreshData() {
            this.flowList = [];
            this.packageList = [];
            this.initData();
        }
    }
});
