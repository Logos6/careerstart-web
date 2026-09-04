// 移植数据文件：可以在 Web 浏览器中作为全局变量或标准 ES Module 使用
// 将原来的 wx 小程序代码封装转换为标准浏览器 window 变量或 export

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CareerData = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  
  /* ---------- 兴趣领域 ---------- */
  const INTERESTS = [
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
  const SKILL_GROUPS = [
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
  const TRAITS = [
    { id: "logic",     label: "逻辑分析", desc: "拆解问题、推理判断、找出规律的能力" },
    { id: "creative",  label: "创造想象", desc: "产生新点子、审美判断、打破常规的能力" },
    { id: "social",    label: "沟通协作", desc: "表达倾听、团队合作、处理关系的能力" },
    { id: "exec",      label: "执行落地", desc: "把事情按时按质做完、抗压推进的能力" },
    { id: "leader",    label: "组织领导", desc: "统筹规划、带动他人、做决策的能力" },
    { id: "handcraft", label: "动手实践", desc: "操作工具设备、解决实际问题的能力" },
  ];

  /* ---------- 工作偏好 ---------- */
  const PREF_ITEMS = [
    { id: "remote",  label: "远程 / 居家办公" },
    { id: "stable",  label: "稳定作息，少加班" },
    { id: "highpay", label: "高薪导向，可接受压力" },
    { id: "growth",  label: "看重成长与晋升空间" },
    { id: "solo",    label: "独立工作，少打交道" },
    { id: "team",    label: "团队协作，氛围活跃" },
    { id: "outdoor", label: "外出走动，不坐班" },
    { id: "startup", label: "灵活创业 / 自由职业" },
  ];

  // 抓取小程序 `data.js` 的完整 JOBS 与 COURSES 数组
  const dataJsContent = require('fs').readFileSync('C:\\Users\\20895\\careerstart_mp\\utils\\data.js', 'utf8');
  
  return {
    INTERESTS,
    SKILL_GROUPS,
    TRAITS,
    PREF_ITEMS,
    // 数据逻辑直接引用原始模块
    ...require('C:\\Users\\20895\\careerstart_mp\\utils\\data.js')
  };
}));
