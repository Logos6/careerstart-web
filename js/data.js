(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CareerData = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

/* ---------- 兴趣领域 ---------- */
var INTERESTS = [
  { id: "tech",     label: "科技与编程", icon: "i-code" },
  { id: "data",     label: "数据与分析", icon: "i-chart" },
  { id: "design",   label: "设计与美学", icon: "i-spark" },
  { id: "media",    label: "内容与媒体", icon: "i-play" },
  { id: "people",   label: "人际与沟通", icon: "i-user" },
  { id: "care",     label: "教育与关怀", icon: "i-heart" },
  { id: "business", label: "商业与管理", icon: "i-trend" },
  { id: "sales",    label: "销售与谈判", icon: "i-brief" },
  { id: "finance",  label: "金融与数字", icon: "i-coin" },
  { id: "make",     label: "动手与制造", icon: "i-gear" },
  { id: "nature",   label: "自然与户外", icon: "i-leaf" },
  { id: "service",  label: "服务与运营", icon: "i-hand" },
];

/* ---------- 技能标签（按领域分组） ---------- */
var SKILL_GROUPS = [
  {
    group: "数字与技术",
    items: [
      { id: "coding",     label: "编程开发" },
      { id: "datatool",   label: "数据分析工具" },
      { id: "office",     label: "办公软件" },
      { id: "aitool",     label: "AI 工具应用" },
      { id: "pm",         label: "项目管理" },
    ],
  },
  {
    group: "创意与表达",
    items: [
      { id: "writing",    label: "写作与文案" },
      { id: "photo",      label: "摄影与剪辑" },
      { id: "uidesign",   label: "视觉设计" },
      { id: "speaking",   label: "演讲与表达" },
      { id: "foreign",    label: "外语能力" },
    ],
  },
  {
    group: "人际与实践",
    items: [
      { id: "sales",      label: "销售谈判" },
      { id: "service",    label: "客户服务" },
      { id: "teach",      label: "教学讲解" },
      { id: "coordinate", label: "组织协调" },
      { id: "accounting", label: "财务知识" },
      { id: "drive",      label: "驾驶技能" },
      { id: "repair",     label: "维修与动手" },
    ],
  },
];

/* ---------- 能力维度（雷达图 6 维） ---------- */
var TRAITS = [
  { id: "logic",     label: "逻辑分析", desc: "拆解问题、推理判断、找出规律的能力" },
  { id: "creative",  label: "创造想象", desc: "产生新点子、审美判断、打破常规的能力" },
  { id: "social",    label: "沟通协作", desc: "表达倾听、团队合作、处理关系的能力" },
  { id: "exec",      label: "执行落地", desc: "把事情按时按质做完、抗压推进的能力" },
  { id: "leader",    label: "组织领导", desc: "统筹规划、带动他人、做决策的能力" },
  { id: "handcraft", label: "动手实践", desc: "操作工具设备、解决实际问题的能力" },
];

/* ---------- 工作偏好 ---------- */
var PREF_ITEMS = [
  { id: "remote",  label: "远程 / 居家办公" },
  { id: "stable",  label: "稳定作息，少加班" },
  { id: "highpay", label: "高薪导向，可接受压力" },
  { id: "growth",  label: "看重成长与晋升空间" },
  { id: "solo",    label: "独立工作，少打交道" },
  { id: "team",    label: "团队协作，氛围活跃" },
  { id: "outdoor", label: "外出走动，不坐班" },
  { id: "startup", label: "灵活创业 / 自由职业" },
];

/* ---------- 职位库 ---------- */
var JOBS = [
  {"id":"pdm","name":"产品经理","icon":"i-compass","cat":"互联网 · 产品","color":"linear-gradient(145deg,#e8f0fe,#d2e3fc)","salary":[15,35],"growth":"晋升路径清晰，3-5 年可带产品线","desc":"连接用户、业务与技术，定义产品要做什么、为什么做，并推动团队把它做出来。","duty":["洞察用户需求，撰写产品方案与原型","协调设计、研发、测试推进项目上线","分析数据与用户反馈，持续迭代产品"],"need":["逻辑清晰，善于结构化思考","同理心强，能站在用户角度想问题","沟通协调与推动力出色"],"fit":{"interests":{"tech":0.8,"business":0.9,"data":0.7,"people":0.7},"traits":{"logic":0.9,"social":0.9,"leader":0.8,"creative":0.7,"exec":0.8},"skills":{"pm":1,"office":0.8,"datatool":0.7,"speaking":0.7,"aitool":0.6},"prefs":{"growth":1,"team":0.9,"highpay":0.7}},"persona":{"student":0.85,"fresh":0.95,"mid":0.55,"mom":0.45}},
  {"id":"fedev","name":"前端开发工程师","icon":"i-code","cat":"互联网 · 技术","color":"linear-gradient(145deg,#e6f4ff,#cbe8ff)","salary":[12,30],"growth":"技术纵深 + 全栈方向，天花板高","desc":"把设计稿变成用户手里真实可用的界面，是离用户最近的工程师。","duty":["使用主流框架开发 Web / 移动端页面","与产品、设计协作还原交互细节","优化页面性能与用户体验"],"need":["扎实的编程基础","对细节和体验有追求","持续学习新技术的能力"],"fit":{"interests":{"tech":1,"design":0.6,"make":0.5},"traits":{"logic":1,"exec":0.8,"creative":0.6,"handcraft":0.5},"skills":{"coding":1,"aitool":0.6,"uidesign":0.5},"prefs":{"highpay":0.8,"growth":0.9,"remote":0.7,"solo":0.6}},"persona":{"student":0.85,"fresh":0.95,"mid":0.55,"mom":0.45}},
  {"id":"datan","name":"数据分析师","icon":"i-chart","cat":"互联网 · 数据","color":"linear-gradient(145deg,#e8f9f0,#d0f2e2)","salary":[12,28],"growth":"各行业通用，越老越吃香","desc":"用数据讲清楚业务发生了什么、为什么发生、接下来该怎么做。","duty":["搭建指标体系，输出经营分析报告","通过数据定位业务问题并给出建议","建设数据看板，支持团队决策"],"need":["对数字敏感，逻辑严谨","掌握 SQL / Excel / BI 工具","能把结论讲得通俗易懂"],"fit":{"interests":{"data":1,"tech":0.7,"finance":0.6,"business":0.6},"traits":{"logic":1,"exec":0.7,"social":0.5},"skills":{"datatool":1,"office":0.9,"coding":0.5,"aitool":0.5},"prefs":{"growth":0.8,"stable":0.7,"highpay":0.7}},"persona":{"student":0.85,"fresh":0.95,"mid":0.55,"mom":0.45}},
  {"id":"uidesigner","name":"UI / 视觉设计师","icon":"i-spark","cat":"互联网 · 设计","color":"linear-gradient(145deg,#fdeefb,#f9d9f5)","salary":[10,25],"growth":"可向体验设计 / 品牌方向发展","desc":"用色彩、排版与图形塑造产品的气质，让好用与好看同时成立。","duty":["负责 App / 网页界面与运营视觉设计","建立并维护设计规范","与前端协作高保真还原设计稿"],"need":["良好的审美与美术功底","熟练使用 Figma / PS 等工具","理解业务，不只是画图"],"fit":{"interests":{"design":1,"media":0.6,"tech":0.5},"traits":{"creative":1,"exec":0.6,"social":0.5},"skills":{"uidesign":1,"photo":0.6,"aitool":0.6,"office":0.4},"prefs":{"growth":0.7,"remote":0.6,"team":0.6,"startup":0.5}},"persona":{"student":0.85,"fresh":0.95,"mid":0.55,"mom":0.45}},
  {"id":"ops","name":"新媒体运营","icon":"i-trend","cat":"互联网 · 运营","color":"linear-gradient(145deg,#fff4e5,#ffe9cc)","salary":[8,18],"growth":"入门友好，可成长为运营负责人","desc":"在内容平台经营账号与社群，用内容吸引用户、用活动留住用户。","duty":["策划选题，产出图文 / 短视频内容","分析平台数据，优化内容策略","策划线上活动，促进转化与涨粉"],"need":["网感好，熟悉各大内容平台","文案功底扎实","数据意识与执行力强"],"fit":{"interests":{"media":1,"people":0.6,"design":0.5,"business":0.5},"traits":{"creative":0.9,"social":0.8,"exec":0.9,"logic":0.5},"skills":{"writing":1,"photo":0.8,"aitool":0.7,"office":0.5},"prefs":{"growth":0.7,"remote":0.6,"startup":0.6,"team":0.6}},"persona":{"student":0.85,"fresh":0.95,"mid":0.55,"mom":0.45}},
  {"id":"creator","name":"短视频创作者 / 编导","icon":"i-play","cat":"内容 · 自媒体","color":"linear-gradient(145deg,#ffeef0,#ffdce1)","salary":[6,30],"growth":"个人 IP 化，收入上限高","desc":"从选题、脚本到拍摄剪辑一手包办，打造属于自己的内容品牌。","duty":["策划账号定位与内容选题","完成脚本撰写、拍摄与剪辑","运营粉丝互动，探索商业变现"],"need":["表达欲强，镜头感好","熟悉剪辑工具与平台规则","能持续稳定地产出内容"],"fit":{"interests":{"media":1,"design":0.6,"people":0.5},"traits":{"creative":1,"exec":0.8,"social":0.6},"skills":{"photo":1,"writing":0.8,"speaking":0.7,"aitool":0.6},"prefs":{"startup":1,"remote":0.9,"solo":0.6,"growth":0.6}},"persona":{"student":0.85,"fresh":0.95,"mid":0.55,"mom":0.45}},
  {"id":"teacher","name":"教师 / 培训讲师","icon":"i-grad","cat":"教育 · 培训","color":"linear-gradient(145deg,#eef0ff,#dde2ff)","salary":[8,20],"growth":"经验复利型职业，越教越值钱","desc":"把知识讲明白，是一件既有价值感又能长期积累的事。","duty":["备课授课，设计教学环节","跟踪学员学习效果并调整方法","参与教研与课程产品开发"],"need":["表达清晰，有耐心有亲和力","学科或技能功底扎实","喜欢与人分享知识"],"fit":{"interests":{"care":1,"people":0.8,"media":0.4},"traits":{"social":1,"exec":0.7,"leader":0.6,"creative":0.5},"skills":{"teach":1,"speaking":1,"writing":0.6,"office":0.5},"prefs":{"stable":0.9,"growth":0.6,"team":0.6}},"persona":{"student":0.5,"fresh":0.7,"mid":0.75,"mom":0.9}},
  {"id":"counselor","name":"心理咨询师","icon":"i-heart","cat":"健康 · 心理","color":"linear-gradient(145deg,#e9f7ff,#d6efff)","salary":[10,30],"growth":"社会需求快速增长，资历越深越受信赖","desc":"陪伴来访者走出困境。人生阅历本身就是这份职业的重要资本。","duty":["提供个体 / 团体心理咨询服务","进行心理测评与个案记录","持续接受督导与专业进修"],"need":["极强的倾听与共情能力","持有相关资质并完成系统培训","情绪稳定，有边界感"],"fit":{"interests":{"care":1,"people":0.9},"traits":{"social":1,"exec":0.6,"logic":0.6},"skills":{"teach":0.5,"speaking":0.7,"writing":0.5},"prefs":{"stable":0.7,"startup":0.6,"remote":0.5}},"persona":{"student":0.5,"fresh":0.7,"mid":0.75,"mom":0.9}},
  {"id":"hrbp","name":"人力资源专员 / HRBP","icon":"i-user","cat":"职能 · 人力","color":"linear-gradient(145deg,#f2ecff,#e6dcff)","salary":[8,20],"growth":"懂业务 + 懂人性，可向 HRVP 发展","desc":"招人、育人、留人，是组织里最懂人的角色。","duty":["负责招聘全流程与人才盘点","组织培训、绩效与员工关系工作","深入业务团队提供人力解决方案"],"need":["善于识人，沟通有分寸","熟悉劳动法规与人力模块","有业务理解与推动力"],"fit":{"interests":{"people":1,"business":0.7,"care":0.5},"traits":{"social":1,"leader":0.7,"exec":0.8,"logic":0.6},"skills":{"office":0.9,"speaking":0.8,"coordinate":0.9,"writing":0.6},"prefs":{"stable":0.8,"growth":0.7,"team":0.9}},"persona":{"student":0.55,"fresh":0.8,"mid":0.8,"mom":0.5}},
  {"id":"pmo","name":"项目经理","icon":"i-layers","cat":"管理 · 项目","color":"linear-gradient(145deg,#e5f6ff,#cfefff)","salary":[12,28],"growth":"各行业通用，管理经验直接变现","desc":"对目标、进度、成本与风险负责，确保一群人把一件事做成。","duty":["制定项目计划并跟踪执行","协调跨部门资源，管理风险","向干系人汇报，推动项目交付"],"need":["极强的责任心与抗压能力","出色的协调与谈判能力","有行业经验者优先"],"fit":{"interests":{"business":1,"people":0.7,"tech":0.4},"traits":{"leader":1,"exec":1,"social":0.9,"logic":0.7},"skills":{"pm":1,"coordinate":1,"office":0.8,"speaking":0.7},"prefs":{"growth":0.8,"highpay":0.7,"team":0.9}},"persona":{"student":0.55,"fresh":0.8,"mid":0.8,"mom":0.5}},
  {"id":"sales","name":"大客户销售","icon":"i-brief","cat":"销售 · B端","color":"linear-gradient(145deg,#fff3e0,#ffe6bf)","salary":[10,40],"growth":"收入与努力强相关，人脉持续增值","desc":"把合适的产品卖给需要的客户。阅历与信任感是成交的加速器。","duty":["开拓并维护企业级客户关系","挖掘需求，定制解决方案并谈判成交","完成回款与客户成功交接"],"need":["目标感强，抗拒绝能力强","懂人情世故，值得客户信赖","行业知识与学习能力"],"fit":{"interests":{"sales":1,"people":0.9,"business":0.8},"traits":{"social":1,"exec":0.9,"leader":0.7},"skills":{"sales":1,"speaking":0.9,"coordinate":0.6,"drive":0.4},"prefs":{"highpay":1,"growth":0.8,"outdoor":0.7,"team":0.6}},"persona":{"student":0.5,"fresh":0.7,"mid":0.85,"mom":0.65}},
  {"id":"ecom","name":"电商运营 / 店主","icon":"i-cart","cat":"电商 · 零售","color":"linear-gradient(145deg,#fef3e8,#fee8d3)","salary":[8,30],"growth":"可打工可创业，路径灵活","desc":"经营一家线上店铺：选品、上架、推广、客服、复盘，全流程操盘。","duty":["负责店铺日常运营与活动策划","分析流量与转化数据，优化投放","管理供应链与客服体验"],"need":["对消费趋势敏感","数据分析与执行力强","能吃苦，创业心态"],"fit":{"interests":{"business":1,"sales":0.7,"data":0.6,"service":0.5},"traits":{"exec":1,"logic":0.7,"social":0.6,"creative":0.5},"skills":{"datatool":0.7,"office":0.7,"photo":0.5,"sales":0.6,"aitool":0.6},"prefs":{"startup":0.9,"highpay":0.7,"growth":0.7,"remote":0.5}},"persona":{"student":0.85,"fresh":0.95,"mid":0.55,"mom":0.45}},
  {"id":"accountant","name":"会计 / 财务专员","icon":"i-coin","cat":"职能 · 财务","color":"linear-gradient(145deg,#e8f5ee,#d2ecdf)","salary":[7,18],"growth":"证书驱动，稳定性极强","desc":"企业的账房先生 / 女士，准则与细心就是竞争力。","duty":["处理日常账务、报销与税务申报","编制财务报表，配合审计","进行成本分析与预算支持"],"need":["细心严谨，对数字负责","持有会计职称 / CPA 更佳","熟悉财务软件与税法"],"fit":{"interests":{"finance":1,"data":0.7,"business":0.4},"traits":{"logic":0.9,"exec":0.9,"social":0.4},"skills":{"accounting":1,"office":0.9,"datatool":0.6},"prefs":{"stable":1,"solo":0.6}},"persona":{"student":0.55,"fresh":0.8,"mid":0.8,"mom":0.5}},
  {"id":"consult","name":"管理咨询顾问","icon":"i-bulb","cat":"咨询 · 商业","color":"linear-gradient(145deg,#ecf3ff,#d9e8ff)","salary":[15,40],"growth":"高强度高回报，行业经验是敲门砖","desc":"帮企业诊断问题、设计方案。35+ 的行业积累正是核心卖点。","duty":["调研访谈，诊断企业经营管理问题","撰写咨询方案并向客户汇报","推动方案落地与效果复盘"],"need":["结构化思维与快速学习能力","优秀的表达与汇报能力","深耕某个行业多年"],"fit":{"interests":{"business":1,"data":0.7,"people":0.6,"finance":0.5},"traits":{"logic":1,"leader":0.8,"social":0.9,"exec":0.8},"skills":{"speaking":0.9,"writing":0.9,"office":0.8,"pm":0.6},"prefs":{"highpay":0.9,"growth":0.9,"team":0.7}},"persona":{"student":0.55,"fresh":0.8,"mid":0.8,"mom":0.5}},
  {"id":"evtech","name":"新能源技术工程师","icon":"i-gear","cat":"制造 · 新能源","color":"linear-gradient(145deg,#e6f9f2,#ccf2e4)","salary":[10,25],"growth":"国家重点赛道，人才缺口大","desc":"投身电池、光伏、储能等热门赛道，做实体产业的技术中坚。","duty":["负责产品测试、工艺改进或设备维护","分析技术问题并输出解决方案","参与新产品试制与量产导入"],"need":["工科背景或相关实操经验","严谨细致，安全意识强","愿意在一线深耕技术"],"fit":{"interests":{"make":1,"tech":0.7,"nature":0.5},"traits":{"handcraft":1,"logic":0.8,"exec":0.8},"skills":{"repair":0.8,"coding":0.4,"datatool":0.5,"office":0.5},"prefs":{"stable":0.8,"growth":0.8,"highpay":0.6}},"persona":{"student":0.4,"fresh":0.6,"mid":0.85,"mom":0.35}},
  {"id":"supply","name":"供应链管理专员","icon":"i-truck","cat":"制造 · 供应链","color":"linear-gradient(145deg,#f0f4ff,#dfe8ff)","salary":[9,22],"growth":"实体经济刚需岗位，经验型职业","desc":"让货在正确的时间、以正确的成本到达正确的地方。","duty":["管理采购、库存与物流计划","对接供应商，优化成本与交期","协调产销节奏，处理异常"],"need":["条理清晰，抗压能力强","谈判与跨部门协调能力","熟悉 ERP 系统优先"],"fit":{"interests":{"business":0.8,"service":0.7,"make":0.6},"traits":{"exec":1,"logic":0.8,"social":0.7,"leader":0.5},"skills":{"office":0.8,"coordinate":0.9,"datatool":0.6,"pm":0.5},"prefs":{"stable":0.8,"growth":0.7,"team":0.6}},"persona":{"student":0.4,"fresh":0.6,"mid":0.85,"mom":0.35}},
  {"id":"health","name":"健康管理师","icon":"i-heart","cat":"健康 · 康养","color":"linear-gradient(145deg,#e9faf3,#d3f4e6)","salary":[8,20],"growth":"老龄化社会刚需，需求持续看涨","desc":"为客户制定饮食、运动与慢病管理方案，是大健康产业的核心岗位。","duty":["评估客户健康状况，建立健康档案","制定个性化健康干预方案","跟踪随访并开展健康宣教"],"need":["医学 / 营养背景或持证优先","耐心细致，有服务意识","善于沟通与科普表达"],"fit":{"interests":{"care":1,"nature":0.6,"people":0.6,"service":0.5},"traits":{"social":0.8,"exec":0.8,"logic":0.6},"skills":{"teach":0.7,"service":0.8,"office":0.5,"writing":0.4},"prefs":{"stable":0.9,"team":0.6}},"persona":{"student":0.5,"fresh":0.7,"mid":0.75,"mom":0.9}},
  {"id":"elder","name":"养老照护管理","icon":"i-hand","cat":"健康 · 康养","color":"linear-gradient(145deg,#fdf1e7,#fbe4d0)","salary":[7,16],"growth":"朝阳行业，管理岗位缺口大","desc":"组织和管理养老机构的照护服务，一份有温度的长期事业。","duty":["制定照护计划并管理护理团队","把控服务质量与安全规范","与家属沟通，处理突发情况"],"need":["有爱心、耐心与责任心","具备基础护理知识与资质","组织协调能力强"],"fit":{"interests":{"care":1,"service":0.7,"people":0.6},"traits":{"social":0.8,"exec":0.9,"leader":0.7},"skills":{"service":0.9,"coordinate":0.8,"teach":0.5},"prefs":{"stable":0.9,"team":0.8}},"persona":{"student":0.5,"fresh":0.7,"mid":0.75,"mom":0.9}},
  {"id":"logi","name":"物流运营 / 仓储主管","icon":"i-truck","cat":"物流 · 运营","color":"linear-gradient(145deg,#fff0e8,#ffe0d1)","salary":[7,18],"growth":"入行门槛低，晋升看重实战经验","desc":"管理仓库与配送网络的日常运转，保障千万件货物准时送达。","duty":["管理仓储作业流程与人员排班","监控时效与破损等运营指标","持续优化流程、降本增效"],"need":["吃苦耐劳，执行力强","现场管理与应变能力","基础数据处理能力"],"fit":{"interests":{"service":0.9,"make":0.6,"business":0.5},"traits":{"exec":1,"handcraft":0.7,"leader":0.6,"logic":0.5},"skills":{"office":0.6,"coordinate":0.8,"drive":0.5},"prefs":{"stable":0.7,"team":0.7}},"persona":{"student":0.4,"fresh":0.6,"mid":0.85,"mom":0.35}},
  {"id":"driver","name":"网约车 / 货运司机","icon":"i-car","cat":"灵活就业","color":"linear-gradient(145deg,#eef7ff,#dbeeff)","salary":[6,15],"growth":"时间自由，即入即赚","desc":"时间自己掌控，多劳多得，是过渡期与灵活就业的务实选择。","duty":["安全驾驶，完成乘客 / 货物运输","维护车辆状况与服务质量","规划接单策略，提高时薪"],"need":["驾龄与驾照符合平台要求","服务意识与安全意识","熟悉城市道路"],"fit":{"interests":{"service":0.7,"nature":0.6,"make":0.5},"traits":{"exec":0.9,"handcraft":0.7,"social":0.5},"skills":{"drive":1,"service":0.6,"coordinate":0.4},"prefs":{"startup":0.7,"outdoor":0.9,"solo":0.7,"stable":0.4}},"persona":{"student":0.6,"fresh":0.75,"mid":0.7,"mom":0.6}},
  {"id":"farm","name":"新农人 / 农产品电商","icon":"i-leaf","cat":"农业 · 创业","color":"linear-gradient(145deg,#eef9e8,#ddf2d0)","salary":[6,25],"growth":"乡村振兴政策红利，差异化创业方向","desc":"用电商和短视频把家乡好货卖出去，把田园变成事业。","duty":["经营农产品线上店铺与直播带货","管理种植 / 养殖与品控","打造产地品牌，对接渠道"],"need":["对农业有热情，能吃苦","内容或电商运营能力","供应链与品控意识"],"fit":{"interests":{"nature":1,"business":0.7,"media":0.6,"make":0.6},"traits":{"exec":0.9,"handcraft":0.8,"creative":0.6,"social":0.5},"skills":{"photo":0.6,"sales":0.6,"writing":0.4,"aitool":0.4},"prefs":{"startup":1,"outdoor":0.9,"solo":0.5}},"persona":{"student":0.4,"fresh":0.6,"mid":0.85,"mom":0.35}},
  {"id":"qa","name":"软件测试工程师","icon":"i-target","cat":"互联网 · 技术","color":"linear-gradient(145deg,#f0ebff,#e3d9ff)","salary":[9,22],"growth":"转行 IT 的友好入口，可进阶自动化","desc":"给软件挑毛病：设计用例、执行测试，守住产品质量的最后一道关。","duty":["编写测试用例并执行功能 / 回归测试","提交并跟踪缺陷，输出测试报告","逐步搭建自动化测试脚本"],"need":["细心耐心，有怀疑精神","逻辑清晰，能复现定位问题","学习基础编程更佳"],"fit":{"interests":{"tech":0.9,"data":0.6,"make":0.4},"traits":{"logic":0.9,"exec":0.9,"handcraft":0.4},"skills":{"coding":0.6,"datatool":0.6,"office":0.6,"aitool":0.5},"prefs":{"stable":0.8,"growth":0.7,"highpay":0.6}},"persona":{"student":0.85,"fresh":0.95,"mid":0.55,"mom":0.45}},
  {"id":"lawyer","name":"法务 / 合规专员","icon":"i-scale","cat":"职能 · 法务","color":"linear-gradient(145deg,#f0f0f5,#e2e2ea)","salary":[10,25],"growth":"专业壁垒高，职业生命周期长","desc":"为企业审查合同、防范法律风险，是企业经营的守门员。","duty":["审查各类合同与法律文件","处理劳动、合同纠纷事务","开展合规培训与风险排查"],"need":["法学背景或通过法考","严谨细致，文字功底强","原则性与沟通能力兼具"],"fit":{"interests":{"business":0.7,"finance":0.5,"people":0.4},"traits":{"logic":1,"exec":0.8,"social":0.6},"skills":{"writing":0.9,"office":0.8,"speaking":0.6},"prefs":{"stable":0.9,"growth":0.7,"solo":0.5}},"persona":{"student":0.55,"fresh":0.8,"mid":0.8,"mom":0.5}},
  {"id":"coach","name":"健身教练","icon":"i-flag","cat":"健康 · 运动","color":"linear-gradient(145deg,#e9fbe9,#d2f6d2)","salary":[8,25],"growth":"技能 + 销售双驱动，可开工作室","desc":"帮助会员科学训练、达成目标，把自己的热爱变成职业。","duty":["评估会员体能，制定训练计划","带教私教课程与团体课","维护会员关系，完成续课目标"],"need":["扎实的训练与营养知识","形象阳光，善于激励他人","持有教练认证资质"],"fit":{"interests":{"nature":0.8,"care":0.6,"sales":0.5,"people":0.6},"traits":{"handcraft":0.8,"social":0.8,"exec":0.8,"leader":0.4},"skills":{"teach":0.8,"sales":0.6,"speaking":0.6,"service":0.6},"prefs":{"outdoor":0.6,"startup":0.6,"highpay":0.6,"team":0.6}},"persona":{"student":0.5,"fresh":0.7,"mid":0.75,"mom":0.9}},
  {"id":"feadmin","name":"行政专员","icon":"i-doc","cat":"职能 · 行政","color":"linear-gradient(145deg,#eef4f1,#d9e8e0)","salary":[6,12],"growth":"企业后勤中枢，向人事、总务、文秘方向发展","desc":"负责公司日常行政事务、办公环境与会议组织，是团队运转的幕后支撑。","duty":["管理办公用品、考勤与来访接待","组织会议、团建与行政采购","整理归档文件，维护办公流程"],"need":["细心有条理，熟练使用办公软件","服务意识强，沟通温和有耐心","能同时处理多件琐碎事务"],"fit":{"interests":{"service":0.8,"business":0.7,"people":0.6},"traits":{"exec":0.9,"social":0.7,"logic":0.6,"handcraft":0.5},"skills":{"office":0.9,"coordinate":0.7,"service":0.6,"speaking":0.5},"prefs":{"stable":0.9,"team":0.7,"remote":0.6}},"persona":{"student":0.6,"fresh":0.8,"mid":0.8,"mom":0.95}},
  {"id":"cust","name":"在线客服专员","icon":"i-chat","cat":"灵活就业 · 客服","color":"linear-gradient(145deg,#e8f6ff,#cfeaff)","salary":[5,10],"growth":"可居家办公，向客服主管、质培方向晋升","desc":"通过线上渠道解答用户问题、处理投诉与售后，维护客户体验。","duty":["在线接待咨询，解答产品与订单问题","受理投诉建议并跟进处理结果","整理高频问题，沉淀服务话术"],"need":["打字快，表达清晰有条理","情绪稳定，抗压能力强","有责任心，能接受排班"],"fit":{"interests":{"service":0.9,"people":0.8,"business":0.5},"traits":{"social":0.8,"exec":0.8,"logic":0.6},"skills":{"service":0.9,"office":0.7,"speaking":0.7,"writing":0.5},"prefs":{"remote":0.9,"stable":0.8,"solo":0.6}},"persona":{"student":0.7,"fresh":0.8,"mid":0.75,"mom":0.9}},
  {"id":"host","name":"直播主播","icon":"i-play","cat":"电商 · 直播","color":"linear-gradient(145deg,#ffe9f2,#ffd2e2)","salary":[8,30],"growth":"头部主播收入上限高，可转运营或自建团队","desc":"在直播间介绍产品、与观众互动并促成下单，是电商增长的引擎。","duty":["按脚本完成产品讲解与演示","与观众互动，营造直播间氛围","复盘数据，优化话术与节奏"],"need":["镜头表现力强，语言有感染力","熟悉产品卖点，反应敏捷","能适应晚间及节假日直播排期"],"fit":{"interests":{"media":0.9,"sales":0.8,"people":0.7},"traits":{"social":0.9,"creative":0.7,"exec":0.7},"skills":{"speaking":0.9,"sales":0.7,"photo":0.5,"writing":0.5},"prefs":{"highpay":0.8,"startup":0.7,"remote":0.6}},"persona":{"student":0.85,"fresh":0.8,"mid":0.5,"mom":0.6}},
  {"id":"writer","name":"文案策划","icon":"i-book","cat":"内容 · 文案","color":"linear-gradient(145deg,#f0edff,#ddd6ff)","salary":[8,20],"growth":"向内容总监、品牌策划方向发展","desc":"用文字打动用户：为品牌、产品与活动撰写文案与策划案。","duty":["撰写广告文案、推文与活动策划","提炼产品卖点，输出品牌故事","配合设计产出落地物料"],"need":["文字功底扎实，语感好","洞察用户心理，善于找角度","能独立策划并按时交付"],"fit":{"interests":{"media":0.9,"design":0.7,"business":0.6},"traits":{"creative":0.9,"logic":0.6,"social":0.6},"skills":{"writing":1,"office":0.6,"uidesign":0.4,"speaking":0.5},"prefs":{"growth":0.8,"solo":0.7,"remote":0.6}},"persona":{"student":0.85,"fresh":0.85,"mid":0.6,"mom":0.6}},
  {"id":"media2","name":"广告投放优化师","icon":"i-chart","cat":"互联网 · 投放","color":"linear-gradient(145deg,#e6f4ff,#c9e6ff)","salary":[10,25],"growth":"效果广告核心岗位，向增长负责人晋升","desc":"负责信息流与搜索广告的投放策略，用数据把预算花出效果。","duty":["搭建广告账户，制定投放计划","监控数据，调整出价与素材","输出投放复盘与优化建议"],"need":["对数字敏感，会用 Excel 分析数据","理解用户心理，会拆解爆款素材","结果导向，抗压能力强"],"fit":{"interests":{"data":0.9,"business":0.8,"tech":0.6},"traits":{"logic":0.9,"exec":0.8,"creative":0.6},"skills":{"datatool":0.9,"office":0.7,"writing":0.5,"aitool":0.6},"prefs":{"highpay":0.8,"growth":0.8,"solo":0.5}},"persona":{"student":0.7,"fresh":0.9,"mid":0.6,"mom":0.45}},
  {"id":"translator","name":"翻译 / 英语助教","icon":"i-brief","cat":"教育 · 语言","color":"linear-gradient(145deg,#e7f7f1,#c9ecdf)","salary":[7,18],"growth":"可发展为同传、国际业务或教研岗","desc":"从事笔译、口译或英语教学辅助工作，把语言能力变成职业。","duty":["完成文档翻译与校对","协助外教课堂或辅导学员","整理课程资料与学习反馈"],"need":["英语听说读写能力扎实","耐心细致，表达准确","有学习力，愿意持续精进"],"fit":{"interests":{"care":0.7,"people":0.7,"media":0.6},"traits":{"exec":0.7,"social":0.7,"logic":0.7},"skills":{"foreign":1,"writing":0.7,"speaking":0.8,"teach":0.6},"prefs":{"stable":0.7,"remote":0.8,"growth":0.6}},"persona":{"student":0.8,"fresh":0.8,"mid":0.6,"mom":0.75}},
  {"id":"nurse","name":"护士 / 护理员","icon":"i-heart","cat":"健康 · 护理","color":"linear-gradient(145deg,#ffeef5,#ffd8e8)","salary":[6,13],"growth":"专业护理人才长期紧缺，可向专科护士发展","desc":"在医院、养老或社区机构提供专业护理与健康照护服务。","duty":["执行护理操作与健康监测","协助医生完成治疗与康复计划","为患者及家属提供健康指导"],"need":["有护理专业背景或证书","细心耐心，有同理心","能适应轮班与体力要求"],"fit":{"interests":{"care":1,"service":0.8,"people":0.6},"traits":{"exec":0.9,"social":0.7,"handcraft":0.8},"skills":{"service":0.9,"teach":0.6,"coordinate":0.6},"prefs":{"stable":0.9,"remote":0.3}},"persona":{"student":0.6,"fresh":0.75,"mid":0.85,"mom":0.8}},
  {"id":"socialw","name":"社工 / 社区服务","icon":"i-leaf","cat":"职能 · 社区","color":"linear-gradient(145deg,#eaf7ec,#d2edd6)","salary":[5,9],"growth":"基层治理岗位稳定，向社区管理发展","desc":"在社区、街道或公益机构开展居民服务与治理工作。","duty":["走访居民，收集需求与反馈","组织社区活动与志愿服务","协助政策宣传与矛盾调解"],"need":["有亲和力，善于与不同人群沟通","有公益心，愿意扎根基层","会基本文书与档案整理"],"fit":{"interests":{"care":0.9,"service":0.9,"people":0.8},"traits":{"social":0.9,"exec":0.8,"leader":0.5},"skills":{"service":0.9,"office":0.7,"speaking":0.7,"coordinate":0.7},"prefs":{"stable":0.9,"team":0.6,"outdoor":0.5}},"persona":{"student":0.5,"fresh":0.65,"mid":0.85,"mom":0.9}},
  {"id":"beauty","name":"美容师 / 美甲师","icon":"i-spark","cat":"健康 · 美业","color":"linear-gradient(145deg,#fff0f7,#ffdcec)","salary":[6,15],"growth":"技术型服务岗，可开店或做培训讲师","desc":"为顾客提供美容护理、美甲造型等专业服务。","duty":["根据顾客需求设计护理方案","规范操作，保证服务品质","维护客情，促进复购与转介绍"],"need":["有相关培训或证书","手法熟练，审美在线","沟通亲切，服务意识强"],"fit":{"interests":{"design":0.8,"service":0.7,"people":0.6},"traits":{"handcraft":0.9,"social":0.7,"creative":0.6},"skills":{"service":0.8,"sales":0.5,"speaking":0.5},"prefs":{"startup":0.7,"stable":0.6,"solo":0.5}},"persona":{"student":0.7,"fresh":0.7,"mid":0.7,"mom":0.85}},
  {"id":"chef","name":"厨师 / 面点师","icon":"i-gear","cat":"灵活就业 · 餐饮","color":"linear-gradient(145deg,#fff3e6,#ffe2c4)","salary":[6,14],"growth":"手艺型岗位，可做主厨或自主开店","desc":"负责菜品或面点制作，用稳定的手艺赢得回头客。","duty":["按标准完成菜品或面点制作","管理食材与出餐流程","研发新菜，提升出品质量"],"need":["有烹饪基础或后厨经验","讲究卫生，手脚麻利","能适应餐饮行业作息"],"fit":{"interests":{"make":0.9,"service":0.6,"nature":0.5},"traits":{"handcraft":1,"exec":0.8,"creative":0.5},"skills":{"repair":0.5,"service":0.6,"coordinate":0.5},"prefs":{"stable":0.7,"startup":0.8,"highpay":0.5}},"persona":{"student":0.4,"fresh":0.55,"mid":0.85,"mom":0.7}},
  {"id":"tour","name":"导游 / 定制游规划师","icon":"i-compass","cat":"灵活就业 · 文旅","color":"linear-gradient(145deg,#e6f9ff,#c4f0ff)","salary":[6,15],"growth":"文旅复苏期需求旺，可做自由导游或旅行社管理","desc":"带队讲解或为客户定制行程，把风景变成好体验。","duty":["制定行程方案并带队讲解","协调交通、住宿与门票","处理旅途中的突发情况"],"need":["表达生动，知识面广","有服务意识与应变能力","能接受频繁出差"],"fit":{"interests":{"nature":0.8,"people":0.8,"media":0.6},"traits":{"social":0.9,"exec":0.7,"leader":0.7},"skills":{"speaking":0.9,"service":0.8,"coordinate":0.7,"foreign":0.5},"prefs":{"outdoor":1,"startup":0.7,"remote":0.5}},"persona":{"student":0.65,"fresh":0.7,"mid":0.7,"mom":0.5}},
  {"id":"insur","name":"保险客户经理","icon":"i-medal","cat":"销售 · 保险","color":"linear-gradient(145deg,#fff7e6,#ffeecb)","salary":[8,25],"growth":"佣金制收入上限高，可组建团队","desc":"为客户规划保障方案，提供长期保险与理财服务。","duty":["开发与维护客户关系","分析需求，配置保障方案","协助理赔与后续服务"],"need":["沟通能力强，敢开口","学习产品条款，专业可信","自律性强，能管理自己的节奏"],"fit":{"interests":{"sales":1,"business":0.7,"people":0.8},"traits":{"social":0.9,"exec":0.8,"logic":0.6},"skills":{"sales":1,"speaking":0.8,"office":0.5,"coordinate":0.5},"prefs":{"highpay":0.9,"startup":0.8,"outdoor":0.6}},"persona":{"student":0.4,"fresh":0.55,"mid":0.9,"mom":0.6}},
  {"id":"housemgr","name":"房产经纪顾问","icon":"i-home","cat":"销售 · 地产","color":"linear-gradient(145deg,#eaf0ff,#d3deff)","salary":[8,20],"growth":"行业回暖周期岗位，向门店管理发展","desc":"为客户提供房源匹配、带看与交易全流程服务。","duty":["维护房源信息，匹配客户需求","带看讲解，促成签约","跟进交易流程与客户关系"],"need":["抗压能力强，目标感明确","熟悉区域楼盘与政策","诚实守信，服务意识好"],"fit":{"interests":{"sales":0.9,"business":0.8,"people":0.7},"traits":{"social":0.9,"exec":0.9,"logic":0.5},"skills":{"sales":0.9,"speaking":0.7,"service":0.6,"drive":0.5},"prefs":{"highpay":0.9,"outdoor":0.8,"startup":0.6}},"persona":{"student":0.35,"fresh":0.6,"mid":0.9,"mom":0.55}},
  {"id":"bank","name":"银行柜员 / 理财专员","icon":"i-coin","cat":"职能 · 金融","color":"linear-gradient(145deg,#e8f1ff,#cfe2ff)","salary":[8,18],"growth":"金融机构稳定岗，向理财师、对公经理发展","desc":"办理柜台业务或为客户提供理财规划与产品配置服务。","duty":["办理存取款、转账等柜台业务","向客户介绍理财产品","维护客户档案与合规流程"],"need":["细心严谨，数字敏感","有亲和力，服务规范","能通过相关从业资格考试"],"fit":{"interests":{"finance":1,"business":0.7,"service":0.6},"traits":{"logic":0.8,"exec":0.9,"social":0.7},"skills":{"accounting":0.7,"office":0.8,"service":0.6,"speaking":0.5},"prefs":{"stable":0.9,"growth":0.7,"team":0.6}},"persona":{"student":0.6,"fresh":0.8,"mid":0.75,"mom":0.7}},
  {"id":"gov","name":"公务员 / 事业编","icon":"i-scale","cat":"职能 · 公共服务","color":"linear-gradient(145deg,#eef2f7,#d9e2ee)","salary":[8,15],"growth":"体制内稳定发展，福利完善","desc":"在政府机关或事业单位从事行政管理与公共服务工作。","duty":["承办行政事务与公文处理","执行政策，服务群众办事","参与调研与材料撰写"],"need":["能通过笔试面试选拔","文字功底与表达能力强","踏实稳重，服务意识好"],"fit":{"interests":{"business":0.7,"service":0.7,"people":0.6},"traits":{"logic":0.8,"exec":0.9,"social":0.6},"skills":{"writing":0.8,"office":0.8,"speaking":0.6,"coordinate":0.6},"prefs":{"stable":1,"growth":0.5,"team":0.5}},"persona":{"student":0.7,"fresh":0.85,"mid":0.8,"mom":0.85}},
  {"id":"fm","name":"工程监理 / 施工管理","icon":"i-layers","cat":"制造 · 工程","color":"linear-gradient(145deg,#fff0e8,#ffdcc8)","salary":[8,18],"growth":"基建与新能源项目多，经验越老越吃香","desc":"负责施工现场的质量、安全与进度管理，确保工程按标准交付。","duty":["巡查现场，把控质量与安全","协调施工进度与各方对接","记录台账，处理现场问题"],"need":["懂图纸与施工规范","责任心强，能吃苦","有沟通协调与应急处理能力"],"fit":{"interests":{"make":0.9,"nature":0.6,"business":0.5},"traits":{"exec":0.9,"handcraft":0.8,"leader":0.6,"logic":0.6},"skills":{"repair":0.7,"coordinate":0.8,"office":0.5,"drive":0.6},"prefs":{"outdoor":0.8,"highpay":0.6,"stable":0.6}},"persona":{"student":0.4,"fresh":0.55,"mid":0.9,"mom":0.3}},
  {"id":"targeted_001","name":"物业客服专员","icon":"i-briefcase","cat":"35+转型","color":"linear-gradient(145deg,#e8f5e9,#c8e6c9)","salary":[4,6],"growth":"工作稳定，晋升空间大","desc":"物业客服专员（成都）","duty":["接待业主来访","处理报修投诉","协调物业费用"],"need":["沟通能力强","有耐心","45岁以下"],"fit":{"interests":{"tech":0.3,"business":0.5,"data":0.3,"people":0.9},"traits":{"logic":0.5,"social":0.9,"leader":0.4,"creative":0.3,"exec":0.7},"skills":{"pm":0.4,"office":0.6,"datatool":0.3,"speaking":0.8,"aitool":0.2},"prefs":{"growth":0.6,"team":0.8,"highpay":0.4}},"persona":{"mid":0.9,"mom":0.7},"source":"BOSS直聘","city":"成都","tags":["年龄友好认证","双休","五险一金","稳定"],"flex":"none","ageFriendly":true,"momFriendly":false,"jobType":"全职"},
  {"id":"targeted_002","name":"小区管家","icon":"i-briefcase","cat":"35+转型","color":"linear-gradient(145deg,#e8f5e9,#c8e6c9)","salary":[5,8],"growth":"可晋升物业主管","desc":"小区管家（成都）","duty":["管理小区日常事务","协调业主关系","组织社区活动"],"need":["亲和力强","有管理经验优先","50岁以下"],"fit":{"interests":{"tech":0.2,"business":0.6,"data":0.3,"people":0.9},"traits":{"logic":0.5,"social":0.9,"leader":0.6,"creative":0.4,"exec":0.7},"skills":{"pm":0.5,"office":0.5,"datatool":0.3,"speaking":0.8,"aitool":0.2},"prefs":{"growth":0.7,"team":0.8,"highpay":0.5}},"persona":{"mid":0.9,"mom":0.8},"source":"BOSS直聘","city":"成都","tags":["年龄友好认证","宝妈友好","可接送孩子","稳定"],"flex":"none","ageFriendly":true,"momFriendly":true,"jobType":"全职"},
  {"id":"targeted_003","name":"前台接待","icon":"i-briefcase","cat":"职能岗位","color":"linear-gradient(145deg,#e8f0fe,#d2e3fc)","salary":[3,5],"growth":"可转行政主管","desc":"前台接待（成都）","duty":["接待来访客人","电话转接","信件收发"],"need":["形象气质佳","普通话标准","40岁以下"],"fit":{"interests":{"tech":0.2,"business":0.4,"data":0.2,"people":0.9},"traits":{"logic":0.4,"social":0.9,"leader":0.3,"creative":0.3,"exec":0.6},"skills":{"pm":0.3,"office":0.7,"datatool":0.2,"speaking":0.8,"aitool":0.2},"prefs":{"growth":0.5,"team":0.7,"highpay":0.3}},"persona":{"mid":0.8,"mom":0.6},"source":"BOSS直聘","city":"成都","tags":["年龄友好认证","双休","轻松"],"flex":"none","ageFriendly":true,"momFriendly":false,"jobType":"全职"},
  {"id":"targeted_004","name":"托管班助教","icon":"i-briefcase","cat":"宝妈弹性","color":"linear-gradient(145deg,#fff3e0,#ffe0b2)","salary":[2,4],"growth":"可晋升班主任","desc":"托管班助教（成都）","duty":["辅导小学生作业","管理班级秩序","与家长沟通"],"need":["有爱心","有耐心","有教师资格证优先"],"fit":{"interests":{"tech":0.2,"business":0.3,"data":0.2,"people":0.9},"traits":{"logic":0.5,"social":0.9,"leader":0.4,"creative":0.4,"exec":0.6},"skills":{"pm":0.3,"office":0.5,"datatool":0.2,"speaking":0.7,"aitool":0.2},"prefs":{"growth":0.5,"team":0.7,"highpay":0.3}},"persona":{"mid":0.6,"mom":0.95},"source":"BOSS直聘","city":"成都","tags":["宝妈友好","可接送孩子","下午班","寒暑假"],"flex":"part","ageFriendly":true,"momFriendly":true,"jobType":"兼职"},
  {"id":"targeted_005","name":"幼儿园保育员","icon":"i-briefcase","cat":"宝妈弹性","color":"linear-gradient(145deg,#fff3e0,#ffe0b2)","salary":[2,3],"growth":"可晋升保育主任","desc":"幼儿园保育员（成都）","duty":["照顾幼儿日常生活","配合教师教学","维护教室卫生"],"need":["喜欢孩子","有保育员证优先","50岁以下"],"fit":{"interests":{"tech":0.1,"business":0.2,"data":0.1,"people":0.95},"traits":{"logic":0.4,"social":0.9,"leader":0.3,"creative":0.4,"exec":0.7},"skills":{"pm":0.2,"office":0.4,"datatool":0.1,"speaking":0.6,"aitool":0.1},"prefs":{"growth":0.4,"team":0.8,"highpay":0.2}},"persona":{"mid":0.5,"mom":0.98},"source":"BOSS直聘","city":"成都","tags":["宝妈友好","可接送孩子","周末双休","寒暑假"],"flex":"none","ageFriendly":true,"momFriendly":true,"jobType":"全职"},
  {"id":"targeted_006","name":"课后辅导老师","icon":"i-briefcase","cat":"宝妈弹性","color":"linear-gradient(145deg,#fff3e0,#ffe0b2)","salary":[3,5],"growth":"可晋升教学主管","desc":"课后辅导老师（成都）","duty":["辅导学生作业","制定学习计划","与家长沟通反馈"],"need":["有教学经验","耐心细致","45岁以下"],"fit":{"interests":{"tech":0.3,"business":0.3,"data":0.3,"people":0.9},"traits":{"logic":0.6,"social":0.8,"leader":0.4,"creative":0.5,"exec":0.6},"skills":{"pm":0.4,"office":0.5,"datatool":0.3,"speaking":0.7,"aitool":0.3},"prefs":{"growth":0.6,"team":0.7,"highpay":0.4}},"persona":{"mid":0.7,"mom":0.9},"source":"BOSS直聘","city":"成都","tags":["宝妈友好","可接送孩子","下午班","时间灵活"],"flex":"part","ageFriendly":true,"momFriendly":true,"jobType":"兼职"},
  {"id":"targeted_007","name":"手工串珠制作","icon":"i-briefcase","cat":"灵活就业","color":"linear-gradient(145deg,#fce4ec,#f8bbd0)","salary":[2,4],"growth":"可发展手工工作室","desc":"手工串珠制作（居家）","duty":["按图纸制作串珠饰品","保证产品质量","按时交货"],"need":["心灵手巧","有耐心","时间充裕"],"fit":{"interests":{"tech":0.1,"business":0.3,"data":0.1,"people":0.4},"traits":{"logic":0.3,"social":0.3,"leader":0.2,"creative":0.8,"exec":0.7},"skills":{"pm":0.2,"office":0.2,"datatool":0.1,"speaking":0.2,"aitool":0.1},"prefs":{"growth":0.3,"team":0.2,"highpay":0.3}},"persona":{"mid":0.4,"mom":0.9},"source":"BOSS直聘","city":"成都","tags":["宝妈友好","居家可做","日结","时间自由"],"flex":"full","ageFriendly":true,"momFriendly":true,"jobType":"兼职"},
  {"id":"targeted_008","name":"电商客服居家","icon":"i-briefcase","cat":"灵活就业","color":"linear-gradient(145deg,#e8f0fe,#d2e3fc)","salary":[3,5],"growth":"可晋升客服主管","desc":"电商客服（居家办公）","duty":["在线解答客户咨询","处理订单问题","维护客户关系"],"need":["打字速度快","沟通能力强","有电商经验优先"],"fit":{"interests":{"tech":0.4,"business":0.6,"data":0.3,"people":0.8},"traits":{"logic":0.5,"social":0.8,"leader":0.3,"creative":0.3,"exec":0.7},"skills":{"pm":0.4,"office":0.6,"datatool":0.3,"speaking":0.7,"aitool":0.3},"prefs":{"growth":0.5,"team":0.5,"highpay":0.4}},"persona":{"mid":0.7,"mom":0.8},"source":"BOSS直聘","city":"成都","tags":["宝妈友好","居家可做","时间灵活","日结"],"flex":"full","ageFriendly":true,"momFriendly":true,"jobType":"兼职"},
  {"id":"targeted_009","name":"社区团购团长","icon":"i-briefcase","cat":"灵活就业","color":"linear-gradient(145deg,#fff3e0,#ffe0b2)","salary":[3,6],"growth":"可发展社区电商","desc":"社区团购团长（成都）","duty":["组织社区团购","管理商品陈列","处理售后问题"],"need":["有社区人脉","沟通能力强","时间灵活"],"fit":{"interests":{"tech":0.3,"business":0.8,"data":0.4,"people":0.9},"traits":{"logic":0.5,"social":0.9,"leader":0.6,"creative":0.5,"exec":0.7},"skills":{"pm":0.5,"office":0.5,"datatool":0.4,"speaking":0.8,"aitool":0.3},"prefs":{"growth":0.7,"team":0.6,"highpay":0.5}},"persona":{"mid":0.6,"mom":0.85},"source":"BOSS直聘","city":"成都","tags":["宝妈友好","可接送孩子","时间自由","收入可观"],"flex":"full","ageFriendly":true,"momFriendly":true,"jobType":"兼职"},
  {"id":"targeted_010","name":"超市促销员","icon":"i-briefcase","cat":"销售","color":"linear-gradient(145deg,#e8f5e9,#c8e6c9)","salary":[3,5],"growth":"可晋升促销主管","desc":"超市促销员（成都）","duty":["负责商品促销活动","解答顾客咨询","维护货架陈列"],"need":["有销售经验","沟通能力强","50岁以下"],"fit":{"interests":{"tech":0.2,"business":0.7,"data":0.3,"people":0.8},"traits":{"logic":0.4,"social":0.8,"leader":0.4,"creative":0.4,"exec":0.6},"skills":{"pm":0.3,"office":0.4,"datatool":0.2,"speaking":0.7,"aitool":0.2},"prefs":{"growth":0.5,"team":0.6,"highpay":0.4}},"persona":{"mid":0.8,"mom":0.7},"source":"BOSS直聘","city":"成都","tags":["年龄友好认证","周末班","日结","轻松"],"flex":"part","ageFriendly":true,"momFriendly":false,"jobType":"兼职"},
  {"id":"targeted_011","name":"房产中介","icon":"i-briefcase","cat":"销售","color":"linear-gradient(145deg,#e8f5e9,#c8e6c9)","salary":[5,10],"growth":"可晋升店长","desc":"房产中介（成都）","duty":["开发房源","带看房源","促成交易"],"need":["有销售经验","沟通能力强","抗压能力强"],"fit":{"interests":{"tech":0.3,"business":0.8,"data":0.4,"people":0.9},"traits":{"logic":0.5,"social":0.9,"leader":0.5,"creative":0.4,"exec":0.7},"skills":{"pm":0.5,"office":0.5,"datatool":0.4,"speaking":0.8,"aitool":0.3},"prefs":{"growth":0.8,"team":0.6,"highpay":0.8}},"persona":{"mid":0.85,"mom":0.5},"source":"BOSS直聘","city":"成都","tags":["年龄友好认证","时间自由","高收入","挑战"],"flex":"full","ageFriendly":true,"momFriendly":false,"jobType":"全职"},
  {"id":"targeted_012","name":"养老护理员","icon":"i-briefcase","cat":"健康","color":"linear-gradient(145deg,#e8f5e9,#c8e6c9)","salary":[4,7],"growth":"可晋升护理主管","desc":"养老护理员（成都）","duty":["照顾老人日常生活","协助康复训练","记录健康状况"],"need":["有爱心","有耐心","有护理经验优先"],"fit":{"interests":{"tech":0.2,"business":0.3,"data":0.2,"people":0.95},"traits":{"logic":0.4,"social":0.9,"leader":0.3,"creative":0.3,"exec":0.7},"skills":{"pm":0.3,"office":0.4,"datatool":0.2,"speaking":0.6,"aitool":0.1},"prefs":{"growth":0.5,"team":0.7,"highpay":0.4}},"persona":{"mid":0.7,"mom":0.8},"source":"BOSS直聘","city":"成都","tags":["年龄友好认证","稳定","五险一金","有意义"],"flex":"none","ageFriendly":true,"momFriendly":false,"jobType":"全职"},
  {"id":"targeted_013","name":"月嫂","icon":"i-briefcase","cat":"健康","color":"linear-gradient(145deg,#fff3e0,#ffe0b2)","salary":[8,15],"growth":"可发展母婴护理品牌","desc":"月嫂（成都）","duty":["照顾产妇和新生儿","制作月子餐","指导母乳喂养"],"need":["有月嫂证","有经验","身体健康"],"fit":{"interests":{"tech":0.1,"business":0.4,"data":0.1,"people":0.95},"traits":{"logic":0.4,"social":0.9,"leader":0.3,"creative":0.4,"exec":0.8},"skills":{"pm":0.3,"office":0.3,"datatool":0.1,"speaking":0.6,"aitool":0.1},"prefs":{"growth":0.6,"team":0.3,"highpay":0.8}},"persona":{"mid":0.6,"mom":0.9},"source":"BOSS直聘","city":"成都","tags":["宝妈友好","高收入","技能型","时间灵活"],"flex":"full","ageFriendly":true,"momFriendly":true,"jobType":"全职"},
  {"id":"targeted_014","name":"便利店店员","icon":"i-briefcase","cat":"零售","color":"linear-gradient(145deg,#e8f0fe,#d2e3fc)","salary":[3,4],"growth":"可晋升店长","desc":"便利店店员（成都）","duty":["收银","理货","清洁"],"need":["有责任心","能适应轮班","50岁以下"],"fit":{"interests":{"tech":0.2,"business":0.4,"data":0.2,"people":0.6},"traits":{"logic":0.4,"social":0.6,"leader":0.3,"creative":0.2,"exec":0.7},"skills":{"pm":0.2,"office":0.4,"datatool":0.2,"speaking":0.5,"aitool":0.1},"prefs":{"growth":0.4,"team":0.5,"highpay":0.3}},"persona":{"mid":0.7,"mom":0.6},"source":"BOSS直聘","city":"成都","tags":["年龄友好认证","稳定","轻松","可轮班"],"flex":"none","ageFriendly":true,"momFriendly":false,"jobType":"全职"},
  {"id":"targeted_015","name":"食堂帮厨","icon":"i-briefcase","cat":"餐饮","color":"linear-gradient(145deg,#e8f5e9,#c8e6c9)","salary":[3,4],"growth":"可晋升厨师","desc":"食堂帮厨（成都）","duty":["协助厨师备菜","清洁厨房","分餐"],"need":["身体健康","有责任心","55岁以下"],"fit":{"interests":{"tech":0.1,"business":0.2,"data":0.1,"people":0.5},"traits":{"logic":0.3,"social":0.5,"leader":0.2,"creative":0.3,"exec":0.8},"skills":{"pm":0.2,"office":0.2,"datatool":0.1,"speaking":0.3,"aitool":0.1},"prefs":{"growth":0.3,"team":0.5,"highpay":0.2}},"persona":{"mid":0.6,"mom":0.5},"source":"BOSS直聘","city":"成都","tags":["年龄友好认证","稳定","包吃","轻松"],"flex":"none","ageFriendly":true,"momFriendly":false,"jobType":"全职"},
  {"id":"targeted_016","name":"在线辅导老师","icon":"i-briefcase","cat":"宝妈弹性","color":"linear-gradient(145deg,#fff3e0,#ffe0b2)","salary":[3,6],"growth":"可晋升教研主管","desc":"在线辅导老师（远程）","duty":["在线辅导学生作业","录制教学视频","与家长沟通学习进度"],"need":["有教学经验","普通话标准","有教师资格证优先"],"fit":{"interests":{"tech":0.4,"business":0.3,"data":0.3,"people":0.9},"traits":{"logic":0.6,"social":0.8,"leader":0.4,"creative":0.5,"exec":0.6},"skills":{"pm":0.4,"office":0.5,"datatool":0.3,"speaking":0.8,"aitool":0.4},"prefs":{"growth":0.7,"team":0.6,"highpay":0.5}},"persona":{"mid":0.7,"mom":0.92},"source":"BOSS直聘","city":"成都","tags":["宝妈友好","居家可做","时间灵活","长期稳定"],"flex":"full","ageFriendly":true,"momFriendly":true,"jobType":"全职"},
  {"id":"targeted_017","name":"社区工作者","icon":"i-briefcase","cat":"35+转型","color":"linear-gradient(145deg,#e8f5e9,#c8e6c9)","salary":[4,6],"growth":"可晋升社区主任","desc":"社区工作者（成都）","duty":["办理居民事务","组织社区活动","协调邻里关系"],"need":["有责任心","沟通能力强","45岁以下"],"fit":{"interests":{"tech":0.3,"business":0.5,"data":0.4,"people":0.9},"traits":{"logic":0.5,"social":0.9,"leader":0.6,"creative":0.4,"exec":0.7},"skills":{"pm":0.5,"office":0.6,"datatool":0.4,"speaking":0.8,"aitool":0.3},"prefs":{"growth":0.6,"team":0.8,"highpay":0.4}},"persona":{"mid":0.85,"mom":0.7},"source":"BOSS直聘","city":"成都","tags":["年龄友好认证","双休","五险一金","离家近"],"flex":"none","ageFriendly":true,"momFriendly":false,"jobType":"全职"},
  {"id":"targeted_018","name":"行政文员","icon":"i-briefcase","cat":"职能岗位","color":"linear-gradient(145deg,#e8f0fe,#d2e3fc)","salary":[3,5],"growth":"可晋升行政主管","desc":"行政文员（成都）","duty":["文件整理归档","会议安排","办公用品管理"],"need":["熟练使用办公软件","细心认真","40岁以下"],"fit":{"interests":{"tech":0.3,"business":0.5,"data":0.4,"people":0.7},"traits":{"logic":0.6,"social":0.7,"leader":0.4,"creative":0.3,"exec":0.8},"skills":{"pm":0.4,"office":0.8,"datatool":0.4,"speaking":0.6,"aitool":0.3},"prefs":{"growth":0.5,"team":0.7,"highpay":0.3}},"persona":{"mid":0.8,"mom":0.7},"source":"BOSS直聘","city":"成都","tags":["年龄友好认证","双休","稳定","轻松"],"flex":"none","ageFriendly":true,"momFriendly":false,"jobType":"全职"},
  {"id":"targeted_019","name":"陪诊师","icon":"i-briefcase","cat":"健康","color":"linear-gradient(145deg,#e8f5e9,#c8e6c9)","salary":[5,10],"growth":"可发展陪诊团队","desc":"陪诊师（成都）","duty":["陪同患者就医","协助挂号取号","记录医嘱"],"need":["有耐心","熟悉医院流程","沟通能力强"],"fit":{"interests":{"tech":0.2,"business":0.5,"data":0.2,"people":0.95},"traits":{"logic":0.5,"social":0.9,"leader":0.4,"creative":0.3,"exec":0.7},"skills":{"pm":0.4,"office":0.4,"datatool":0.2,"speaking":0.8,"aitool":0.2},"prefs":{"growth":0.6,"team":0.5,"highpay":0.6}},"persona":{"mid":0.7,"mom":0.85},"source":"BOSS直聘","city":"成都","tags":["宝妈友好","时间灵活","女性优势","新兴职业"],"flex":"full","ageFriendly":true,"momFriendly":true,"jobType":"全职"},
  {"id":"targeted_020","name":"新媒体运营","icon":"i-briefcase","cat":"运营转型","color":"linear-gradient(145deg,#e8f0fe,#d2e3fc)","salary":[5,8],"growth":"可晋升运营总监","desc":"新媒体运营（远程）","duty":["运营公众号/小红书","撰写推文","分析数据"],"need":["有文案功底","熟悉新媒体平台","有运营经验优先"],"fit":{"interests":{"tech":0.5,"business":0.7,"data":0.5,"people":0.7},"traits":{"logic":0.5,"social":0.7,"leader":0.5,"creative":0.8,"exec":0.6},"skills":{"pm":0.5,"office":0.6,"datatool":0.5,"speaking":0.6,"aitool":0.5},"prefs":{"growth":0.8,"team":0.5,"highpay":0.6}},"persona":{"mid":0.8,"mom":0.75},"source":"BOSS直聘","city":"成都","tags":["宝妈友好","居家可做","技能型","长期稳定"],"flex":"full","ageFriendly":true,"momFriendly":true,"jobType":"全职"},
  {"id":"targeted_021","name":"平面设计师","icon":"i-briefcase","cat":"技术转型","color":"linear-gradient(145deg,#e8f0fe,#d2e3fc)","salary":[4,8],"growth":"可晋升设计主管","desc":"平面设计师（远程）","duty":["设计海报/宣传物料","品牌视觉设计","与客户沟通需求"],"need":["熟练使用PS/AI","有设计作品","有审美能力"],"fit":{"interests":{"tech":0.4,"business":0.4,"data":0.3,"people":0.6},"traits":{"logic":0.5,"social":0.6,"leader":0.4,"creative":0.9,"exec":0.6},"skills":{"pm":0.4,"office":0.5,"datatool":0.3,"speaking":0.5,"aitool":0.4},"prefs":{"growth":0.7,"team":0.4,"highpay":0.6}},"persona":{"mid":0.75,"mom":0.7},"source":"BOSS直聘","city":"成都","tags":["宝妈友好","居家可做","技能型","自由接单"],"flex":"full","ageFriendly":true,"momFriendly":true,"jobType":"全职"},
  {"id":"targeted_022","name":"物业管家","icon":"i-briefcase","cat":"35+转型","color":"linear-gradient(145deg,#e8f5e9,#c8e6c9)","salary":[4,6],"growth":"可晋升物业经理","desc":"物业管家（成都）","duty":["管理业主档案","处理日常报修","组织社区活动"],"need":["亲和力强","有服务意识","45岁以下"],"fit":{"interests":{"tech":0.3,"business":0.6,"data":0.4,"people":0.9},"traits":{"logic":0.5,"social":0.9,"leader":0.6,"creative":0.4,"exec":0.7},"skills":{"pm":0.5,"office":0.6,"datatool":0.4,"speaking":0.8,"aitool":0.3},"prefs":{"growth":0.6,"team":0.8,"highpay":0.4}},"persona":{"mid":0.85,"mom":0.75},"source":"BOSS直聘","city":"成都","tags":["年龄友好认证","双休","五险一金","离家近"],"flex":"none","ageFriendly":true,"momFriendly":false,"jobType":"全职"},
  {"id":"targeted_023","name":"在线客服","icon":"i-briefcase","cat":"灵活就业","color":"linear-gradient(145deg,#e8f0fe,#d2e3fc)","salary":[3,5],"growth":"可晋升客服主管","desc":"在线客服（居家办公）","duty":["在线解答客户咨询","处理售后问题","记录客户反馈"],"need":["打字速度快","沟通能力强","有耐心"],"fit":{"interests":{"tech":0.4,"business":0.5,"data":0.3,"people":0.8},"traits":{"logic":0.5,"social":0.8,"leader":0.3,"creative":0.3,"exec":0.7},"skills":{"pm":0.3,"office":0.6,"datatool":0.3,"speaking":0.7,"aitool":0.3},"prefs":{"growth":0.5,"team":0.5,"highpay":0.3}},"persona":{"mid":0.7,"mom":0.85},"source":"BOSS直聘","city":"成都","tags":["宝妈友好","居家可做","时间灵活","长期稳定"],"flex":"full","ageFriendly":true,"momFriendly":true,"jobType":"全职"},
  {"id":"targeted_024","name":"文案写手","icon":"i-briefcase","cat":"运营转型","color":"linear-gradient(145deg,#e8f0fe,#d2e3fc)","salary":[4,7],"growth":"可晋升内容总监","desc":"文案写手（远程）","duty":["撰写产品文案","编辑推文内容","策划选题"],"need":["文笔好","有创意","熟悉网络热点"],"fit":{"interests":{"tech":0.4,"business":0.5,"data":0.3,"people":0.6},"traits":{"logic":0.5,"social":0.6,"leader":0.4,"creative":0.9,"exec":0.6},"skills":{"pm":0.4,"office":0.5,"datatool":0.3,"speaking":0.5,"aitool":0.4},"prefs":{"growth":0.7,"team":0.4,"highpay":0.5}},"persona":{"mid":0.75,"mom":0.8},"source":"BOSS直聘","city":"成都","tags":["宝妈友好","居家可做","技能型","时间自由"],"flex":"full","ageFriendly":true,"momFriendly":true,"jobType":"全职"},
  {"id":"targeted_025","name":"数据标注员","icon":"i-briefcase","cat":"技术转型","color":"linear-gradient(145deg,#e8f0fe,#d2e3fc)","salary":[3,5],"growth":"可晋升标注组长","desc":"数据标注员（远程）","duty":["标注训练数据","质检数据","反馈问题"],"need":["细心认真","会使用电脑","有耐心"],"fit":{"interests":{"tech":0.5,"business":0.3,"data":0.6,"people":0.4},"traits":{"logic":0.6,"social":0.4,"leader":0.3,"creative":0.3,"exec":0.8},"skills":{"pm":0.3,"office":0.6,"datatool":0.5,"speaking":0.3,"aitool":0.4},"prefs":{"growth":0.5,"team":0.4,"highpay":0.3}},"persona":{"mid":0.7,"mom":0.8},"source":"BOSS直聘","city":"成都","tags":["宝妈友好","居家可做","时间灵活","长期稳定"],"flex":"full","ageFriendly":true,"momFriendly":true,"jobType":"全职"}
];

/* ---------- 两类服务人群（35+转型 & 宝妈） ---------- */
var PERSONAS = [
  {
    id: "mid", icon: "i-flag", title: "35+ 重新出发",
    desc: "有一定职场或人生阅历，正在经历转型或再就业，希望把经验变成新的竞争力。",
  },
  {
    id: "mom", icon: "i-heart", title: "宝妈重返职场",
    desc: "曾因家庭暂别职场，现在希望以弹性、稳妥的方式重新回到工作状态。",
  },
];

/* ---------- 测评步骤（按人群动态组合） ---------- */
var STEP_DEFS = {
  persona:  { label: "身份",   title: "你的当前状态", tip: "不同的人生阶段，适合的机会也不一样。告诉我们你的情况，推荐会更准。" },
  major:    { label: "背景",   title: "你的专业背景", tip: "专业不代表枷锁，但它能帮我们找到与你知识储备衔接最顺的方向。" },
  city:     { label: "期望",   title: "期望城市与薪资", tip: "实话实说就好。我们会结合不同城市的岗位密度与薪资水平来推荐。" },
  exp:      { label: "积累",   title: "你的职场积累", tip: "你在过往行业里沉淀的经验，正是转型时最值钱的家底。" },
  schedule: { label: "时间",   title: "你能投入的时间", tip: "重返职场不必一步到位，先找到与家庭节奏匹配的起点。" },
  interest: { label: "兴趣",   title: "你的兴趣爱好", tip: "选出你真正感兴趣、愿意投入时间的领域（建议 2 ~ 4 个）。兴趣是长期动力的来源。" },
  skill:    { label: "技能",   title: "你会什么", tip: "勾选你已经掌握的技能（建议 2 ~ 6 个）。哪怕是「办公软件熟练」也算数。" },
  trait:    { label: "能力",   title: "你能做什么", tip: "按真实自我评价拖动滑杆（1 ~ 10 分）。没有标准答案，诚实作答结果更可信。" },
  pref:     { label: "偏好",   title: "你想要什么", tip: "选出你对下一份工作最看重的条件（可多选）。这决定了推荐结果的排序。" },
};

/* 各人群的步骤序列 */
var PERSONA_STEPS = {
  mid:     ["persona", "exp", "interest", "skill", "trait", "pref"],
  mom:     ["persona", "schedule", "interest", "skill", "trait", "pref"],
};

/* ---------- 差异化步骤的选项 ---------- */
var MAJOR_ITEMS = [
  { id: "cs",      label: "计算机 / 软件" },
  { id: "eng",     label: "工科类" },
  { id: "biz",     label: "经管 / 商科" },
  { id: "lang",    label: "语言 / 文学" },
  { id: "art",     label: "设计 / 艺术" },
  { id: "edu",     label: "教育 / 师范" },
  { id: "med",     label: "医药 / 护理" },
  { id: "law",     label: "法学" },
  { id: "sci",     label: "理学 / 农学" },
  { id: "othermj", label: "其他专业" },
];

var GRADE_ITEMS = [
  { id: "g1", label: "大一 / 大二", desc: "时间充裕，适合提前布局" },
  { id: "g2", label: "大三", desc: "实习与校招的关键窗口" },
  { id: "g3", label: "大四 / 研二研三", desc: "即将进入求职季" },
  { id: "g4", label: "研究生 / 博士生", desc: "更高学历赛道" },
];

var CITY_ITEMS = [
  { id: "tier1",  label: "北上广深" },
  { id: "new1",   label: "新一线城市" },
  { id: "tier23", label: "二三线城市" },
  { id: "home",   label: "回到家乡" },
  { id: "any",    label: "不限城市" },
];

var SALARY_ITEMS = [
  { id: "s1", label: "4-6K 先入行" },
  { id: "s2", label: "6-10K 稳妥起步" },
  { id: "s3", label: "10-15K 能力变现" },
  { id: "s4", label: "15K+ 高目标" },
];

var EXP_ITEMS = [
  { id: "e1", label: "1-3 年", desc: "初级岗位经验" },
  { id: "e2", label: "3-8 年", desc: "骨干或小组负责人" },
  { id: "e3", label: "8-15 年", desc: "中层管理或资深专家" },
  { id: "e4", label: "15 年以上", desc: "高管或行业老兵" },
];

var OPEN_ITEMS = [
  { id: "same",  label: "留在本行业", desc: "延续积累，稳中求变" },
  { id: "adj",   label: "相关领域延伸", desc: "技能可迁移的相邻赛道" },
  { id: "new",   label: "彻底换赛道", desc: "愿意从零开始学习新领域" },
];

var SCHEDULE_ITEMS = [
  { id: "full",  label: "可以全职", desc: "朝九晚五或全职坐班" },
  { id: "part",  label: "半天 / 弹性", desc: "每天 4-6 小时为宜" },
  { id: "kids",  label: "接送孩子时段外", desc: "9:00-16:00 最佳" },
  { id: "home2", label: "以居家为主", desc: "远程线上完成工作" },
];

var COMMUTE_ITEMS = [
  { id: "near", label: "步行 / 15 分钟内" },
  { id: "mid2", label: "30 分钟内可接受" },
  { id: "far",  label: "1 小时内都行" },
  { id: "none", label: "不考虑通勤，要远程" },
];

/* ---------- 主页职业路径（按人群） ---------- */
var PATHS = {
  mid: [
    { icon: "i-trend", title: "经验变现路线", desc: "咨询 / 项目管理 / 培训讲师", bg: "linear-gradient(150deg,#ff9f0a,#c47b00)" },
    { icon: "i-heart", title: "大健康产业", desc: "健康管理 / 心理 / 康养照护", bg: "linear-gradient(150deg,#64d2ff,#2a9dc9)" },
    { icon: "i-cart", title: "轻创业路线", desc: "电商 / 自媒体 / 社区生意", bg: "linear-gradient(150deg,#bf5af2,#8e3bb8)" },
    { icon: "i-car", title: "灵活就业过渡", desc: "时间自由，先站稳再起跳", bg: "linear-gradient(150deg,#6e6e73,#3a3a3c)" },
  ],
  mom: [
    { icon: "i-home", title: "居家办公路线", desc: "线上客服 / 内容审核 / 云店员", bg: "linear-gradient(150deg,#0a84ff,#0057d9)" },
    { icon: "i-play", title: "亲子内容赛道", desc: "宝妈博主 / 母婴好物分享", bg: "linear-gradient(150deg,#ff6482,#c9345f)" },
    { icon: "i-grad", title: "教育陪伴方向", desc: "托管老师 / 绘本阅读指导", bg: "linear-gradient(150deg,#5e5ce6,#3634a3)" },
    { icon: "i-cart", title: "社区轻创业", desc: "社区团购 / 家庭工作室", bg: "linear-gradient(150deg,#30d158,#1a8f3c)" },
  ],
};

var CATEGORIES = ["全部", "35+转型", "宝妈弹性", "运营转型", "技术转型", "职能岗位", "互联网", "内容", "教育", "健康", "职能", "管理", "销售", "电商", "制造", "物流", "农业", "咨询", "灵活就业"];

/* ---------- 技能课程库（覆盖全部招聘大类） ---------- */
var COURSES = [
  { id: "c-excel", cat: "职能", icon: "i-chart", title: "Excel 从零到精通", sub: "王佩丰 · 24节全集", lessons: 24, hours: 24, xp: 30, bg: "linear-gradient(150deg,#1d8fa8,#106d81)", skills: ["office", "datatool"], url: "https://www.bilibili.com/video/BV1fx411a7bB" },
  { id: "c-excel2", cat: "职能", icon: "i-chart", title: "Excel VBA 入门到实战", sub: "自动化办公 · 效率提升10倍", lessons: 30, hours: 15, xp: 28, bg: "linear-gradient(150deg,#2a6f97,#1a4b6d)", skills: ["office", "datatool"], url: "https://www.bilibili.com/video/BV1Eb411a7Fq" },
  { id: "c-word", cat: "职能", icon: "i-doc", title: "Word 文档排版速成", sub: "公文 / 合同 / 长文档", lessons: 15, hours: 6, xp: 15, bg: "linear-gradient(150deg,#2a8fc9,#1d6da0)", skills: ["office"], url: "https://www.bilibili.com/video/BV1as411a7bN" },
  { id: "c-ppt", cat: "职能", icon: "i-layers", title: "PPT 设计与演示实战", sub: "逻辑 / 排版 / 动画 / 演讲", lessons: 20, hours: 8, xp: 18, bg: "linear-gradient(150deg,#d95f33,#b04a26)", skills: ["office", "speaking"], url: "https://www.bilibili.com/video/BV1R4411N7bT" },
  { id: "c-acc", cat: "职能", icon: "i-coin", title: "零基础学会计", sub: "考证 / 做账 / 报税全流程", lessons: 40, hours: 20, xp: 35, bg: "linear-gradient(150deg,#2ea56a,#1f8f56)", skills: ["accounting", "office"], url: "https://www.bilibili.com/video/BV1Ss411a7bN" },
  { id: "c-comm", cat: "职能", icon: "i-chat", title: "职场沟通表达课", sub: "汇报 / 跨部门协作 / 面试表达", lessons: 14, hours: 5, xp: 18, bg: "linear-gradient(150deg,#5ac8fa,#2a8fc9)", skills: ["speaking", "coordinate"], url: "https://www.bilibili.com/video/BV1d4411a7bZ" },
  { id: "c-en", cat: "职能", icon: "i-book", title: "职场英语充电站", sub: "面试口语 / 商务邮件", lessons: 20, hours: 8, xp: 20, bg: "linear-gradient(150deg,#2ea56a,#1f8f56)", skills: ["foreign"], url: "https://www.bilibili.com/video/BV1d4411a7bZ" },
  { id: "c-ai", cat: "互联网", icon: "i-spark", title: "AI 工具生产力课", sub: "提示词 / ChatGPT / 办公自动化", lessons: 18, hours: 6, xp: 22, bg: "linear-gradient(150deg,#2e7dff,#0a58ff)", skills: ["aitool", "office"], url: "https://www.bilibili.com/video/BV17s411a7bN" },
  { id: "c-ai2", cat: "互联网", icon: "i-spark", title: "AI 副业变现实战", sub: "AIGC / 接单 / 内容生成", lessons: 20, hours: 8, xp: 24, bg: "linear-gradient(150deg,#0a58ff,#0038b8)", skills: ["aitool", "writing"], url: "https://www.bilibili.com/video/BV17s411a7bN" },
  { id: "c-python", cat: "互联网", icon: "i-code", title: "Python 零基础入门", sub: "小甲鱼全套 · 边学边练", lessons: 90, hours: 40, xp: 40, bg: "linear-gradient(150deg,#17171c,#2b2b33)", skills: ["coding"], url: "https://www.bilibili.com/video/BV1c4411d7jb" },
  { id: "c-net", cat: "互联网", icon: "i-code", title: "互联网入行训练营", sub: "产品 / 运营 / 研发通识", lessons: 32, hours: 12, xp: 30, bg: "linear-gradient(150deg,#0a58ff,#0038b8)", skills: ["aitool", "office", "pm"], url: "https://www.bilibili.com/video/BV1d4411a7bZ" },
  { id: "c-media", cat: "内容", icon: "i-play", title: "短视频创作实战", sub: "脚本 / 拍摄 / 剪辑 / 起号", lessons: 24, hours: 9, xp: 25, bg: "linear-gradient(150deg,#ff6482,#c9345f)", skills: ["photo", "writing"], url: "https://www.bilibili.com/video/BV1d4411a7bZ" },
  { id: "c-clip", cat: "内容", icon: "i-play", title: "剪映零基础速成", sub: "手机剪辑 / 转场 / 字幕 / 特效", lessons: 18, hours: 7, xp: 20, bg: "linear-gradient(150deg,#ff6482,#c9345f)", skills: ["photo"], url: "https://www.bilibili.com/video/BV1d4411a7bZ" },
  { id: "c-ps", cat: "内容", icon: "i-spark", title: "PS 修图与视觉设计基础", sub: "抠图 / 调色 / 海报排版", lessons: 22, hours: 9, xp: 24, bg: "linear-gradient(150deg,#8e5cf7,#5e3ab8)", skills: ["photo", "uidesign"], url: "https://www.bilibili.com/video/BV1d4411a7bZ" },
  { id: "c-write", cat: "内容", icon: "i-doc", title: "商业文案写作课", sub: "爆款标题 / 转化文案 / 品牌稿", lessons: 16, hours: 6, xp: 18, bg: "linear-gradient(150deg,#c9345f,#a02647)", skills: ["writing", "speaking"], url: "https://www.bilibili.com/video/BV1d4411a7bZ" },
  { id: "c-ecom", cat: "电商", icon: "i-cart", title: "电商开店全流程", sub: "选品 / 投放 / 转化优化", lessons: 28, hours: 11, xp: 26, bg: "linear-gradient(150deg,#8e5cf7,#6a3bd6)", skills: ["datatool", "photo", "sales"], url: "https://www.bilibili.com/video/BV1d4411a7bZ" },
  { id: "c-momshop", cat: "电商", icon: "i-cart", title: "宝妈轻创业指南", sub: "选品 / 社群团购 / 时间管理", lessons: 20, hours: 7, xp: 22, bg: "linear-gradient(150deg,#ff9f0a,#c47b00)", skills: ["sales", "writing"], url: "https://www.bilibili.com/video/BV1d4411a7bZ" },
  { id: "c-cb", cat: "电商", icon: "i-book", title: "跨境电商英语", sub: "选品术语 / 客服邮件 / 平台", lessons: 18, hours: 7, xp: 20, bg: "linear-gradient(150deg,#5e5ce6,#3634a3)", skills: ["foreign", "sales"], url: "https://www.bilibili.com/video/BV1d4411a7bZ" },
  { id: "c-sale", cat: "销售", icon: "i-brief", title: "大客户成交课", sub: "需求挖掘 / 谈判 / 回款", lessons: 20, hours: 8, xp: 22, bg: "linear-gradient(150deg,#d9b45c,#b8942f)", skills: ["sales", "speaking"], url: "https://www.bilibili.com/video/BV1d4411a7bZ" },
  { id: "c-nego", cat: "销售", icon: "i-brief", title: "销售谈判与异议处理", sub: "破冰 / 逼单 / 价格博弈", lessons: 16, hours: 6, xp: 18, bg: "linear-gradient(150deg,#d9b45c,#b8942f)", skills: ["sales", "speaking"], url: "https://www.bilibili.com/video/BV1d4411a7bZ" },
  { id: "c-heal", cat: "健康", icon: "i-heart", title: "健康管理师备考班", sub: "营养学 / 慢病管理 / 考证", lessons: 40, hours: 20, xp: 35, bg: "linear-gradient(150deg,#2ea56a,#1f8f56)", skills: ["service", "teach"], url: "https://www.bilibili.com/video/BV1d4411a7bZ" },
  { id: "c-psych", cat: "健康", icon: "i-heart", title: "心理咨询入门", sub: "倾听技巧 / 基础理论 / 伦理", lessons: 24, hours: 10, xp: 24, bg: "linear-gradient(150deg,#64d2ff,#2a9dc9)", skills: ["teach", "speaking"], url: "https://www.bilibili.com/video/BV1d4411a7bZ" },
  { id: "c-nutri", cat: "健康", icon: "i-leaf", title: "营养与体重管理", sub: "膳食搭配 / 慢病饮食 / 配餐", lessons: 20, hours: 8, xp: 20, bg: "linear-gradient(150deg,#4d9c33,#3a7a26)", skills: ["service", "teach"], url: "https://www.bilibili.com/video/BV1d4411a7bZ" },
  { id: "c-mgmt", cat: "管理", icon: "i-layers", title: "项目管理 PMP 精讲", sub: "进度 / 风险 / 干系人管理", lessons: 30, hours: 15, xp: 30, bg: "linear-gradient(150deg,#d97a16,#b05f0e)", skills: ["pm", "coordinate"], url: "https://www.bilibili.com/video/BV1d4411a7bZ" },
  { id: "c-cons", cat: "咨询", icon: "i-bulb", title: "结构化思维训练", sub: "问题拆解 / 方案汇报", lessons: 20, hours: 9, xp: 25, bg: "linear-gradient(150deg,#3a3a42,#26262d)", skills: ["speaking", "writing", "office"], url: "https://www.bilibili.com/video/BV1d4411a7bZ" },
  { id: "c-pm2", cat: "互联网", icon: "i-compass", title: "从零做产品经理", sub: "需求分析 / 原型 / 文档", lessons: 28, hours: 12, xp: 28, bg: "linear-gradient(150deg,#0a58ff,#0038b8)", skills: ["pm", "aitool", "office"], url: "https://www.bilibili.com/video/BV1d4411a7bZ" },
  { id: "c-flex", cat: "灵活就业", icon: "i-car", title: "灵活就业安全指南", sub: "平台规则 / 权益保障", lessons: 10, hours: 3, xp: 12, bg: "linear-gradient(150deg,#2a8fc9,#1d6da0)", skills: ["drive", "service"], url: "https://www.bilibili.com/video/BV1d4411a7bZ" },
  { id: "c-rideshare", cat: "灵活就业", icon: "i-car", title: "网约车合规上岗课", sub: "平台规则 / 接单技巧 / 安全", lessons: 10, hours: 3, xp: 12, bg: "linear-gradient(150deg,#2a8fc9,#1d6da0)", skills: ["drive", "service"], url: "https://www.bilibili.com/video/BV1d4411a7bZ" },
];

/* ---------- 任务系统（三层递进） ---------- */
var TASKS = [
  { id: "t-assess",  icon: "i-compass", title: "盘点你的职场优势", sub: "把多年经验，变成清晰的重启方向", xp: 40, tier: 1 },
  { id: "t-detail",  icon: "i-target",  title: "查看 1 个目标岗位", sub: "看清它到底要什么，值不值得去", xp: 15, tier: 1 },
  { id: "t-fav",     icon: "i-star",    title: "锁定 1 个心仪岗位", sub: "放进你的重启清单", xp: 15, tier: 1 },
  { id: "t-tab",     icon: "i-layers",  title: "浏览职位库", sub: "看看现在有哪些机会适合你", xp: 10, tier: 1 },
  { id: "t-course",  icon: "i-book",    title: "开始 1 门技能课", sub: "为转型补上关键一环", xp: 20, tier: 1 },
  { id: "t-gap1",    icon: "i-trend",   title: "掌握 1 项新技能", sub: "完成任意课程的 50%", xp: 50, tier: 2 },
  { id: "t-gap2",    icon: "i-flag",    title: "学完 1 门完整课程", sub: "把新技能真正学到手", xp: 80, tier: 2 },
  { id: "t-detail5", icon: "i-target",  title: "横向对比 5 个岗位", sub: "看清哪个方向更适合你", xp: 40, tier: 2 },
  { id: "t-fav5",    icon: "i-star",    title: "建立岗位备选清单", sub: "收藏 5 个心仪岗位", xp: 40, tier: 2 },
  { id: "t-gap3",    icon: "i-medal",   title: "学完 3 门课程", sub: "你的技能体系开始成型", xp: 120, tier: 3 },
  { id: "t-fav10",   icon: "i-star",    title: "收藏 10 个岗位", sub: "广撒网，再精选", xp: 80, tier: 3 },
  { id: "t-redo",    icon: "i-redo",    title: "更新你的职业策略", sub: "阶段不同了，重新校准方向", xp: 50, tier: 3 },
];

var TIER_NAMES = { 1: "起步", 2: "进阶", 3: "深化" };
var TIER_ICONS = { 1: "i-flag", 2: "i-trend", 3: "i-medal" };

/* ---------- 每步完成时的赞扬语 ---------- */
var PRAISES = [
  ["定位完成","了解自己，是改变的开始"],
  ["背景已录入","你的积累，自有它的价值"],
  ["目标已锚定","清晰的目标，是行动的起点"],
  ["眼光真好","热爱的事里藏着你的天赋"],
  ["实力不俗","这些技能都是你的底气"],
  ["认知清晰","了解自己的人才能走得远"],
  ["目标明确","知道自己想要什么，很重要"],
  ["测评完成","你的职业画像已生成，请查收"]
];

return {
  INTERESTS: INTERESTS,
  SKILL_GROUPS: SKILL_GROUPS,
  TRAITS: TRAITS,
  PREF_ITEMS: PREF_ITEMS,
  JOBS: JOBS,
  PERSONAS: PERSONAS,
  STEP_DEFS: STEP_DEFS,
  PERSONA_STEPS: PERSONA_STEPS,
  MAJOR_ITEMS: MAJOR_ITEMS,
  GRADE_ITEMS: GRADE_ITEMS,
  CITY_ITEMS: CITY_ITEMS,
  SALARY_ITEMS: SALARY_ITEMS,
  EXP_ITEMS: EXP_ITEMS,
  OPEN_ITEMS: OPEN_ITEMS,
  SCHEDULE_ITEMS: SCHEDULE_ITEMS,
  COMMUTE_ITEMS: COMMUTE_ITEMS,
  PATHS: PATHS,
  CATEGORIES: CATEGORIES,
  COURSES: COURSES,
  TASKS: TASKS,
  TIER_NAMES: TIER_NAMES,
  TIER_ICONS: TIER_ICONS,
  PRAISES: PRAISES
};

}));
