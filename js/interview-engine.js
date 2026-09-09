/**
 * AI 模拟面试引擎 v4.0
 * 
 * 核心架构：
 * 1. RAG分析模块 — 从简历/JD提取关键词，生成个性化题库
 * 2. 状态机 — 管理面试流程（开场→背景→能力→行为→收尾）
 * 3. 评估引擎 — 多维度打分，决定追问还是推进
 * 4. 动态出题 — 根据候选人背景和回答质量选题
 * 5. 报告生成 — 结构化多维度评估
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.InterviewEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  // ═══════════════════════════════════════════════════
  //  0. 专业题库加载（来自 question_bank.js）
  // ═══════════════════════════════════════════════════

  const QB = (typeof QuestionBank !== 'undefined') ? QuestionBank : null;

  // ═══════════════════════════════════════════════════
  //  1. 题库系统 — 按维度×难度组织
  // ═══════════════════════════════════════════════════

  const QUESTION_BANK = {
    // ── 自我介绍 & 背景 ──
    self_intro: {
      dimension: '沟通表达',
      questions: [
        { id: 'si1', q: '请用3分钟介绍一下你自己，重点说说你的工作经历和核心能力。', difficulty: 1, tags: ['通用'] },
        { id: 'si2', q: '如果你只能用3个关键词形容自己，你会选哪3个？为什么？', difficulty: 1, tags: ['通用'] },
        { id: 'si3', q: '能聊聊你最近一份工作吗？你主要负责什么？', difficulty: 1, tags: ['通用'] },
      ],
    },

    career_gap: {
      dimension: '抗压韧性',
      questions: [
        { id: 'cg1', q: '我看你简历里有一段职业空白期，能说说这段时间你做了什么吗？', difficulty: 1, tags: ['35+', '宝妈'] },
        { id: 'cg2', q: '离开职场一段时间后，重新找工作最大的挑战是什么？', difficulty: 2, tags: ['35+', '宝妈'] },
        { id: 'cg3', q: '空白期有没有保持学习或做些什么来保持专业状态？', difficulty: 1, tags: ['35+', '宝妈'] },
        { id: 'cg4', q: '家人对你重新工作是什么态度？你怎么平衡家庭和工作？', difficulty: 2, tags: ['宝妈'] },
        { id: 'cg5', q: '你觉得自己和一直在职场的人相比，优势和劣势分别是什么？', difficulty: 2, tags: ['35+', '宝妈'] },
      ],
    },

    career_change: {
      dimension: '学习成长',
      questions: [
        { id: 'cc1', q: '你为什么想从原来的行业/岗位转到这个方向？', difficulty: 1, tags: ['转行'] },
        { id: 'cc2', q: '为了这次转型，你做了哪些准备？', difficulty: 2, tags: ['转行'] },
        { id: 'cc3', q: '你觉得原来的工作经验对新岗位有什么帮助？', difficulty: 2, tags: ['转行'] },
        { id: 'cc4', q: '新岗位和你之前做的差别很大，你打算怎么快速上手？', difficulty: 2, tags: ['转行'] },
        { id: 'cc5', q: '如果转型失败，你的Plan B是什么？', difficulty: 3, tags: ['转行'] },
      ],
    },

    // ── 专业能力 ──
    professional: {
      dimension: '专业能力',
      questions: [
        { id: 'p1', q: '能说说你做过的最有成就感的一个项目吗？你在里面的角色是什么？', difficulty: 2, tags: ['通用'] },
        { id: 'p2', q: '在你过去的工作中，遇到过最复杂的技术/业务问题是什么？你怎么解决的？', difficulty: 3, tags: ['通用'] },
        { id: 'p3', q: '你觉得自己在专业领域最大的优势是什么？能举个例子说明吗？', difficulty: 2, tags: ['通用'] },
        { id: 'p5', q: '如果让你现在做一个你从来没做过的项目，你会怎么入手？', difficulty: 2, tags: ['通用'] },
        { id: 'p6', q: '你平时怎么保持自己的专业能力不掉队？最近学了什么新东西？', difficulty: 1, tags: ['通用'] },
        { id: 'p7', q: '能说说你工作中用得最多的工具或方法论吗？为什么觉得它好用？', difficulty: 1, tags: ['通用'] },
        { id: 'p9', q: '你觉得你所在领域未来3年最大的变化会是什么？你怎么应对？', difficulty: 3, tags: ['通用'] },
        { id: 'p10', q: '如果入职后发现实际工作和面试描述差距很大，你会怎么处理？', difficulty: 2, tags: ['通用'] },
        { id: 'p11', q: '你在前一份工作中最有价值的一个贡献是什么？', difficulty: 2, tags: ['通用'] },
        { id: 'p12', q: '如果领导交给你一个完全超出你能力范围的任务，你会怎么做？', difficulty: 2, tags: ['通用'] },
        { id: 'p14', q: '你觉得自己在专业上最需要提升的是什么？', difficulty: 1, tags: ['通用'] },
        { id: 'p16', q: '说说你对这个岗位的理解，你觉得最重要的能力是什么？', difficulty: 2, tags: ['通用'] },
      ],
    },

    problem_solving: {
      dimension: '问题解决',
      questions: [
        { id: 'ps1', q: '讲一个你独立解决过的最难的问题，从发现到解决的完整过程。', difficulty: 3, tags: ['通用'] },
        { id: 'ps2', q: '你有没有遇到过那种「按理说应该成功但失败了」的情况？你怎么复盘的？', difficulty: 3, tags: ['通用'] },
        { id: 'ps3', q: '工作中遇到信息不全但必须快速决策的情况，你一般怎么处理？', difficulty: 2, tags: ['通用'] },
        { id: 'ps4', q: '能举一个你用数据驱动决策的例子吗？', difficulty: 2, tags: ['通用'] },
        { id: 'ps5', q: '你犯过最大的工作错误是什么？后来怎么处理的？', difficulty: 2, tags: ['通用'] },
      ],
    },

    team_collab: {
      dimension: '团队协作',
      questions: [
        { id: 'tc1', q: '讲一次你和同事意见不合的经历，最后怎么解决的？', difficulty: 2, tags: ['通用'] },
        { id: 'tc2', q: '你更喜欢独立工作还是团队协作？为什么？', difficulty: 1, tags: ['通用'] },
        { id: 'tc3', q: '在团队里，你通常扮演什么角色？能举个例子吗？', difficulty: 2, tags: ['通用'] },
        { id: 'tc4', q: '如果团队成员工作不配合，你会怎么处理？', difficulty: 2, tags: ['通用'] },
        { id: 'tc5', q: '你有没有跨部门协作的经验？遇到过什么困难？', difficulty: 2, tags: ['通用'] },
        { id: 'tc6', q: '你觉得一个好的团队最重要的是什么？', difficulty: 1, tags: ['通用'] },
      ],
    },

    // ── 行为面试（STAR） ──
    behavioral: {
      dimension: '综合',
      questions: [
        { id: 'b1', q: '请举一个你主动承担额外责任的例子。', difficulty: 2, tags: ['通用'] },
        { id: 'b2', q: '讲一个你在压力下完成任务的经历。', difficulty: 2, tags: ['抗压'] },
        { id: 'b3', q: '说一个你推动改变或改进的成功案例。', difficulty: 3, tags: ['通用'] },
        { id: 'b4', q: '你有没有过「明知很难但还是坚持做了」的经历？', difficulty: 2, tags: ['抗压'] },
        { id: 'b5', q: '讲一个你帮助同事/下属成长的例子。', difficulty: 2, tags: ['管理'] },
        { id: 'b6', q: '你做过最冒险的一个决定是什么？结果怎么样？', difficulty: 3, tags: ['通用'] },
        { id: 'b7', q: '讲一次你面对客户/用户投诉的经历，你是怎么处理的？', difficulty: 2, tags: ['客服'] },
      ],
    },

    // ── 压力测试 ──
    pressure: {
      dimension: '抗压韧性',
      questions: [
        { id: 'pt1', q: '如果领导当众批评你，你会怎么反应？', difficulty: 2, tags: ['通用'] },
        { id: 'pt2', q: '你经历过最崩溃的工作时刻是什么？', difficulty: 2, tags: ['通用'] },
        { id: 'pt3', q: '连续加班一周后，你发现项目方向全错了，你会怎么办？', difficulty: 3, tags: ['通用'] },
        { id: 'pt4', q: '你怎么看待加班？能接受什么程度的加班？', difficulty: 1, tags: ['通用'] },
      ],
    },

    // ── 职业规划 ──
    career_plan: {
      dimension: '学习成长',
      questions: [
        { id: 'cp1', q: '你未来3年的职业规划是什么？', difficulty: 1, tags: ['通用'] },
        { id: 'cp2', q: '你为什么选择我们公司/这个行业？', difficulty: 1, tags: ['通用'] },
        { id: 'cp3', q: '你理想中的工作是什么样的？', difficulty: 1, tags: ['通用'] },
        { id: 'cp4', q: '你期望的薪资是多少？怎么考虑的？', difficulty: 1, tags: ['通用'] },
      ],
    },

    // ── 反问环节 ──
    closing: {
      dimension: '沟通表达',
      questions: [
        { id: 'end1', q: '你有什么想问我的吗？', difficulty: 1, tags: ['通用'] },
      ],
    },
  };

  // 维度定义
  const DIMENSIONS = {
    '专业能力': { weight: 0.25, icon: '💼', description: '岗位所需的专业知识和技能' },
    '沟通表达': { weight: 0.20, icon: '💬', description: '表达清晰度、逻辑性、感染力' },
    '问题解决': { weight: 0.20, icon: '🧩', description: '分析问题、制定方案、执行落地' },
    '团队协作': { weight: 0.15, icon: '🤝', description: '沟通协调、冲突处理、团队贡献' },
    '学习成长': { weight: 0.10, icon: '📈', description: '学习能力、自我提升、适应变化' },
    '抗压韧性': { weight: 0.10, icon: '💪', description: '压力管理、情绪调节、逆境应对' },
  };

  // 面试官人格
  const PERSONAS = {
    hr: {
      name: 'HR面试官',
      style: '亲和友善',
      greeting: '你好，欢迎参加今天的面试。我是HR，今天我们来聊聊你的经历和想法。',
      reactions: {
        good: ['回答得很好，我了解了。', '嗯，说得挺清楚的。', '好的，这个回答不错。'],
        mid: ['嗯，我大概理解了。', '好的，知道了。', '嗯，了解。'],
        weak: ['嗯...能再具体一些吗？', '这个回答有点笼统。', '我需要更多细节。'],
      },
      transitions: ['接下来我想了解一下——', '那我再问一个——', '好的，下一个问题——'],
    },
    tech: {
      name: '技术面试官',
      style: '专业严谨',
      greeting: '你好，我是今天的技术面试官。我们来聊聊你的专业能力和项目经验。',
      reactions: {
        good: ['回答得很专业。', '嗯，理解到位。', '这个思路不错。'],
        mid: ['嗯，基本对。', '可以，继续。', '了解。'],
        weak: ['这个回答不够深入。', '能再具体说说吗？', '我需要更多技术细节。'],
      },
      transitions: ['我再问一个技术问题——', '关于技术方面——', '接下来聊聊——'],
    },
    manager: {
      name: '部门主管',
      style: '务实直接',
      greeting: '你好，我是你未来可能的直属领导。我们来聊聊你的能力和经验，看看是否匹配。',
      reactions: {
        good: ['嗯，挺好的。', '回答得不错。', '这个可以。'],
        mid: ['嗯，知道了。', '好的。', '了解了。'],
        weak: ['嗯...再想想？', '这个回答不太够。', '说具体一点。'],
      },
      transitions: ['好，下一个问题——', '那我再问一个——', '接下来——'],
    },
  };

  // 岗位关键词映射
  const JOB_KEYWORDS = {
    tech: ['开发', '工程师', '技术', '架构', '后端', '前端', '测试', '运维', 'AI', '算法', '数据', 'Python', 'Java', 'Go', 'React', 'Vue'],
    product: ['产品经理', '产品', '策划', '运营', '增长', '用户增长', '内容运营', '活动运营'],
    design: ['设计', 'UI', 'UX', '视觉', '交互', '平面', '美术'],
    sales: ['销售', '商务', '客户', 'BD', '拓展', '渠道'],
    management: ['管理', '总监', '主管', '经理', 'Leader', 'VP'],
    hr: ['HR', '人事', '招聘', '薪酬', '绩效', '培训'],
    finance: ['财务', '会计', '审计', '税务', '出纳'],
    marketing: ['市场', '品牌', '推广', '营销', '广告', '公关'],
    education: ['教育', '培训', '老师', '教学', '课程'],
    medical: ['医疗', '护士', '医生', '药', '护理'],
  };

  // ═══════════════════════════════════════════════════
  //  2. 岗位专业题库 — 按岗位类型组织
  // ═══════════════════════════════════════════════════

  const JOB_QUESTIONS = {
    // ── 新媒体运营 ──
    新媒体运营: {
      dimension: '专业能力',
      questions: [
        { id: 'nm1', q: '你做过哪些新媒体平台？哪个平台的运营效果最好，为什么？', difficulty: 2 },
        { id: 'nm2', q: '如果让你从0到1搭建一个账号，你会怎么规划内容方向？', difficulty: 2 },
        { id: 'nm3', q: '你写过爆款内容吗？能分析一下那条内容为什么能火？', difficulty: 3 },
        { id: 'nm4', q: '你平时怎么找热点？能说说你追热点的一个成功案例吗？', difficulty: 2 },
        { id: 'nm5', q: '你熟悉哪些数据分析工具？怎么用数据指导内容优化？', difficulty: 2 },
        { id: 'nm6', q: '抖音、小红书、公众号这三个平台的运营逻辑有什么区别？', difficulty: 2 },
        { id: 'nm7', q: '你怎么做用户画像分析？能举个实际例子吗？', difficulty: 3 },
        { id: 'nm8', q: '如果账号流量一直上不去，你会从哪些方面排查原因？', difficulty: 3 },
        { id: 'nm9', q: '你了解SEO吗？怎么优化内容让它更容易被搜索到？', difficulty: 2 },
        { id: 'nm10', q: '你做过社群运营吗？怎么提高社群的活跃度和转化率？', difficulty: 2 },
        { id: 'nm11', q: '短视频和图文内容，你觉得哪个更适合什么场景？', difficulty: 2 },
        { id: 'nm12', q: '你怎么看待AI生成内容？在运营中会怎么用？', difficulty: 2 },
        { id: 'nm13', q: '你有投放经验吗？怎么评估一个渠道的投放效果？', difficulty: 3 },
        { id: 'nm14', q: '说说你对私域流量的理解，你做过哪些私域运营？', difficulty: 2 },
        { id: 'nm15', q: '如果老板要求你一个月涨粉10万，你会怎么拆解目标？', difficulty: 3 },
      ],
    },

    // ── 内容运营 ──
    内容运营: {
      dimension: '专业能力',
      questions: [
        { id: 'co1', q: '你平时怎么规划内容日历？能说说你的内容排期思路吗？', difficulty: 2 },
        { id: 'co2', q: '你怎么判断一篇内容的质量好不好？有什么评估标准？', difficulty: 2 },
        { id: 'co3', q: '你做过内容矩阵吗？不同平台的内容怎么差异化？', difficulty: 3 },
        { id: 'co4', q: '说说你对内容SEO的理解，怎么让内容获得更多自然流量？', difficulty: 2 },
        { id: 'co5', q: '你怎么平衡内容的质量和数量？', difficulty: 2 },
      ],
    },

    // ── 活动运营 ──
    活动运营: {
      dimension: '专业能力',
      questions: [
        { id: 'ao1', q: '你策划过最成功的一个活动是什么？能说说完整流程吗？', difficulty: 2 },
        { id: 'ao2', q: '活动策划前你会做哪些准备工作？', difficulty: 2 },
        { id: 'ao3', q: '怎么评估一个活动的效果？你看哪些核心指标？', difficulty: 2 },
        { id: 'ao4', q: '如果活动参与人数不及预期，你会怎么调整？', difficulty: 3 },
        { id: 'ao5', q: '线上活动和线下活动的运营重点有什么不同？', difficulty: 2 },
      ],
    },

    // ── 用户运营 ──
    用户运营: {
      dimension: '专业能力',
      questions: [
        { id: 'uo1', q: '你怎么理解用户生命周期管理？能举个实际例子吗？', difficulty: 2 },
        { id: 'uo2', q: '你做过用户分层吗？怎么划分用户群体？', difficulty: 2 },
        { id: 'uo3', q: '怎么提高用户留存率？你用过哪些方法？', difficulty: 3 },
        { id: 'uo4', q: '用户流失了你会怎么挽回？能说说你的经验吗？', difficulty: 2 },
        { id: 'uo5', q: 'NPS、DAU、MAU这些指标你都了解吗？怎么用？', difficulty: 2 },
      ],
    },

    // ── 电商运营 ──
    电商运营: {
      dimension: '专业能力',
      questions: [
        { id: 'eo1', q: '你做过哪些电商平台？各平台的运营策略有什么区别？', difficulty: 2 },
        { id: 'eo2', q: '怎么打造一个爆款商品？从选品到推广说说你的思路。', difficulty: 3 },
        { id: 'eo3', q: '你做过直播带货吗？怎么策划一场直播？', difficulty: 2 },
        { id: 'eo4', q: '店铺流量下降了30%，你会从哪些方面排查？', difficulty: 3 },
        { id: 'eo5', q: '你怎么做竞品分析？能举个例子吗？', difficulty: 2 },
      ],
    },

    // ── 产品经理 ──
    产品经理: {
      dimension: '专业能力',
      questions: [
        { id: 'pm1', q: '你做过的最成功的一个产品功能是什么？从需求到上线说说。', difficulty: 2 },
        { id: 'pm2', q: '你怎么收集和筛选用户需求？', difficulty: 2 },
        { id: 'pm3', q: '说说你对产品思维的理解，你觉得做好产品经理最重要的是什么？', difficulty: 2 },
        { id: 'pm4', q: '你怎么写PRD？能说说你的文档结构吗？', difficulty: 2 },
        { id: 'pm5', q: '开发说你的需求做不了，你怎么沟通？', difficulty: 3 },
        { id: 'pm6', q: '你怎么做竞品分析？用什么工具和方法？', difficulty: 2 },
        { id: 'pm7', q: '说说你熟悉的产品方法论，比如KANO模型、MVP？', difficulty: 3 },
        { id: 'pm8', q: '你怎么衡量一个功能上线后的效果？', difficulty: 2 },
      ],
    },

    // ── 数据分析 ──
    数据分析: {
      dimension: '专业能力',
      questions: [
        { id: 'da1', q: '你最常用的数据分析工具是什么？能说说你的分析流程吗？', difficulty: 2 },
        { id: 'da2', q: '怎么搭建一个数据指标体系？能举个例子吗？', difficulty: 3 },
        { id: 'da3', q: '你做过AB测试吗？怎么设计实验方案？', difficulty: 3 },
        { id: 'da4', q: '数据量很大的时候你会怎么优化查询效率？', difficulty: 3 },
        { id: 'da5', q: '你怎么向非技术人员汇报数据分析结果？', difficulty: 2 },
      ],
    },

    // ── 客户服务 ──
    客户服务: {
      dimension: '专业能力',
      questions: [
        { id: 'cs1', q: '你处理过最难缠的客户投诉是什么？最后怎么解决的？', difficulty: 2 },
        { id: 'cs2', q: '你怎么定义好的客户服务？能举个你的成功案例吗？', difficulty: 2 },
        { id: 'cs3', q: '客户情绪很激动的时候，你怎么安抚？', difficulty: 2 },
        { id: 'cs4', q: '你怎么处理客户投诉和公司利益的冲突？', difficulty: 3 },
        { id: 'cs5', q: '你用过哪些客服工具？怎么提高客服效率？', difficulty: 2 },
      ],
    },

    // ── 行政/文员 ──
    行政: {
      dimension: '专业能力',
      questions: [
        { id: 'ad1', q: '你平时怎么安排领导的日程和会议？能说说你的时间管理方法吗？', difficulty: 2 },
        { id: 'ad2', q: '你怎么确保文件和档案管理有序？', difficulty: 1 },
        { id: 'ad3', q: '公司要组织一次年会，你会怎么策划和执行？', difficulty: 2 },
        { id: 'ad4', q: '你怎么和各部门沟通协调？能举个例子吗？', difficulty: 2 },
        { id: 'ad5', q: '你熟悉哪些办公软件？有什么高级用法吗？', difficulty: 1 },
      ],
    },

    // ── 人事/HR ──
    人事: {
      dimension: '专业能力',
      questions: [
        { id: 'hr1', q: '你做过哪些招聘渠道？哪个渠道效果最好？', difficulty: 2 },
        { id: 'hr2', q: '你怎么筛选简历？看重候选人的哪些方面？', difficulty: 2 },
        { id: 'hr3', q: '说说你对绩效考核的理解，你用过什么考核方法？', difficulty: 3 },
        { id: 'hr4', q: '你怎么处理员工关系问题？能举个例子吗？', difficulty: 2 },
        { id: 'hr5', q: '你怎么设计培训计划？怎么评估培训效果？', difficulty: 3 },
      ],
    },

    // ── 财务 ──
    财务: {
      dimension: '专业能力',
      questions: [
        { id: 'fn1', q: '你最擅长哪个财务模块？能说说你的经验吗？', difficulty: 2 },
        { id: 'fn2', q: '你怎么确保财务数据的准确性？', difficulty: 2 },
        { id: 'fn3', q: '说说你对税务筹划的理解，有实际操作经验吗？', difficulty: 3 },
        { id: 'fn4', q: '你怎么编制预算？能说说你的流程吗？', difficulty: 2 },
        { id: 'fn5', q: '你怎么向管理层汇报财务状况？', difficulty: 2 },
      ],
    },

    // ── 销售 ──
    销售: {
      dimension: '专业能力',
      questions: [
        { id: 'sl1', q: '你最好的销售业绩是什么？能说说你是怎么做到的吗？', difficulty: 2 },
        { id: 'sl2', q: '你怎么开发新客户？用过哪些方法？', difficulty: 2 },
        { id: 'sl3', q: '客户说"太贵了"，你怎么回应？', difficulty: 2 },
        { id: 'sl4', q: '你怎么维护老客户关系？能举个例子吗？', difficulty: 2 },
        { id: 'sl5', q: '谈谈你对销售漏斗的理解，你怎么管理客户？', difficulty: 3 },
      ],
    },

    // ── 教师/培训 ──
    教师: {
      dimension: '专业能力',
      questions: [
        { id: 'te1', q: '你教过什么科目/课程？你的教学风格是什么样的？', difficulty: 2 },
        { id: 'te2', q: '你怎么让课堂变得有趣？能举个例子吗？', difficulty: 2 },
        { id: 'te3', q: '学生学习动力不足，你会怎么激发？', difficulty: 3 },
        { id: 'te4', q: '你怎么评估学生的学习效果？', difficulty: 2 },
        { id: 'te5', q: '你怎么和家长沟通学生的学习情况？', difficulty: 2 },
      ],
    },

    // ── 前台/接待 ──
    前台: {
      dimension: '专业能力',
      questions: [
        { id: 're1', q: '你觉得前台岗位最重要的职责是什么？', difficulty: 1 },
        { id: 're2', q: '有访客来访但负责人不在，你怎么处理？', difficulty: 2 },
        { id: 're3', q: '你怎么确保公司电话和快递管理有序？', difficulty: 1 },
        { id: 're4', q: '遇到情绪不好的来访者，你怎么应对？', difficulty: 2 },
        { id: 're5', q: '你怎么协调会议室和办公用品的管理？', difficulty: 1 },
      ],
    },

    // ── 物业管理 ──
    物业: {
      dimension: '专业能力',
      questions: [
        { id: 'pr1', q: '你管理过哪些类型的物业项目？能说说你的经验吗？', difficulty: 2 },
        { id: 'pr2', q: '业主投诉噪音问题，你怎么处理？', difficulty: 2 },
        { id: 'pr3', q: '你怎么协调保洁、安保、维修这几个部门？', difficulty: 2 },
        { id: 'pr4', q: '小区要做垃圾分类推广，你会怎么策划？', difficulty: 3 },
        { id: 'pr5', q: '你怎么控制物业运营成本？', difficulty: 3 },
      ],
    },

    // ── 托管/幼教 ──
    托管: {
      dimension: '专业能力',
      questions: [
        { id: 'ca1', q: '你有托管/幼教经验吗？能说说你带过的孩子年龄段？', difficulty: 1 },
        { id: 'ca2', q: '孩子之间发生冲突，你怎么处理？', difficulty: 2 },
        { id: 'ca3', q: '你怎么确保孩子在托管期间的安全？', difficulty: 2 },
        { id: 'ca4', q: '家长来接孩子时孩子哭闹不肯走，你怎么安抚？', difficulty: 2 },
        { id: 'ca5', q: '你怎么和家长沟通孩子在托管的表现？', difficulty: 2 },
      ],
    },

    // ── 通用岗位（兜底） ──
    通用: {
      dimension: '综合',
      questions: [
        { id: 'gn1', q: '你为什么想做这个岗位？', difficulty: 1 },
        { id: 'gn2', q: '你觉得自己做这个岗位最大的优势是什么？', difficulty: 2 },
        { id: 'gn3', q: '你能为这个岗位带来什么价值？', difficulty: 2 },
        { id: 'gn4', q: '你怎么看待这个岗位的日常工作？', difficulty: 1 },
        { id: 'gn5', q: '你之前的工作经历对这个岗位有什么帮助？', difficulty: 2 },
      ],
    },
  };

  // 岗位名称 → 岗位类型映射
  const JOB_TYPE_MAP = {
    '新媒体运营': '新媒体运营', '新媒体': '新媒体运营', '内容运营': '新媒体运营', '短视频运营': '新媒体运营',
    '内容运营': '内容运营', '内容编辑': '内容运营', '文案策划': '内容运营',
    '活动运营': '活动运营', '活动策划': '活动运营', '市场活动': '活动运营',
    '用户运营': '用户运营', '社群运营': '用户运营', '会员运营': '用户运营',
    '电商运营': '电商运营', '店铺运营': '电商运营', '直播运营': '电商运营',
    '产品经理': '产品经理', '产品': '产品经理', '产品助理': '产品经理',
    '数据分析': '数据分析', '数据分析师': '数据分析', 'BI': '数据分析',
    '客服': '客户服务', '客户服务': '客户服务', '售后': '客户服务',
    '行政': '行政', '行政文员': '行政', '文员': '行政', '行政助理': '行政',
    '人事': '人事', 'HR': '人事', '招聘': '人事', '人力资源': '人事',
    '财务': '财务', '会计': '财务', '出纳': '财务', '审计': '财务',
    '销售': '销售', '业务': '销售', '商务': '销售', '客户经理': '销售',
    '教师': '教师', '老师': '教师', '培训师': '教师', '讲师': '教师',
    '前台': '前台', '接待': '前台', '行政前台': '前台',
    '物业': '物业', '物业管理': '物业', '物业主管': '物业',
    '托管': '托管', '托管老师': '托管', '幼教': '托管', '保育': '托管',
  };

  function matchJobType(jobName) {
    if (!jobName) return '通用';
    const name = jobName.trim();
    // 精确匹配
    if (JOB_TYPE_MAP[name]) return JOB_TYPE_MAP[name];
    // 模糊匹配
    for (const [keyword, type] of Object.entries(JOB_TYPE_MAP)) {
      if (name.includes(keyword) || keyword.includes(name)) return type;
    }
    return '通用';
  }

  // ═══════════════════════════════════════════════════
  //  3. RAG分析模块 — 从简历/JD提取信息
  // ═══════════════════════════════════════════════════

  function analyzeResume(resumeText) {
    if (!resumeText) return { skills: [], experiences: [], keywords: [], companies: [], years: null, education: null, achievements: [], hasResume: false };

    const text = resumeText.toLowerCase();

    // 提取技能关键词
    const allSkills = [
      'JavaScript', 'TypeScript', 'Python', 'Java', 'Go', 'C++', 'SQL', 'React', 'Vue', 'Angular',
      'Node.js', 'Docker', 'Kubernetes', 'AWS', 'Linux', 'Git', 'MySQL', 'Redis', 'MongoDB',
      'Figma', 'Sketch', 'Photoshop', 'Illustrator', 'Excel', 'PPT', 'Word',
      '项目管理', '需求分析', '数据分析', '用户研究', '竞品分析', 'A/B测试',
      '团队管理', '跨部门协作', '客户沟通', '方案设计', '架构设计',
      '内容运营', '活动策划', '社群运营', 'SEO', 'SEM', '新媒体',
      '财务分析', '预算管理', '成本控制', '审计', '税务',
    ];

    const foundSkills = allSkills.filter(s => text.includes(s.toLowerCase()));

    // 提取工作年限
    const yearMatch = resumeText.match(/(\d+)\s*年(?:工作经验|工作经历|经验)/);
    const years = yearMatch ? parseInt(yearMatch[1]) : null;

    // 提取公司/项目信息
    const companies = [];
    const companyPatterns = [
      /在([^\s,，。、]+)(?:担任|任职|工作|实习)/g,
      /([^\s,，。、]+)(?:公司|集团|科技|技术)/g,
    ];
    for (const pattern of companyPatterns) {
      let match;
      while ((match = pattern.exec(resumeText)) !== null) {
        if (match[1].length >= 2 && match[1].length <= 20) {
          companies.push(match[1]);
        }
      }
    }

    // 提取学历
    const eduMatch = resumeText.match(/(博士|硕士|本科|大专|高中|中专)/);
    const education = eduMatch ? eduMatch[1] : null;

    // 提取数字成果
    const achievements = [];
    const numberPatterns = [
      /(?:提升|增长|增加|优化|降低|节省|创造|带来).*?(\d+[%％万元]+)/g,
      /(\d+[%％万元]+).*(?:提升|增长|增加|优化|降低|节省|创造|带来)/g,
      /(?:团队|负责|管理).*?(\d+)\s*(?:人|人团队|人小组)/g,
    ];
    for (const pattern of numberPatterns) {
      let match;
      while ((match = pattern.exec(resumeText)) !== null) {
        achievements.push(match[0]);
      }
    }

    return {
      skills: foundSkills,
      years,
      companies: [...new Set(companies)].slice(0, 5),
      education,
      achievements: [...new Set(achievements)].slice(0, 5),
      keywords: foundSkills,
      hasResume: true,
    };
  }

  function analyzeJD(jdText) {
    if (!jdText) return { requiredSkills: [], responsibilities: [], keywords: [], jobTypes: [], hasJD: false };

    const text = jdText.toLowerCase();

    // 提取技能要求
    const allSkills = [
      'JavaScript', 'TypeScript', 'Python', 'Java', 'Go', 'C++', 'SQL', 'React', 'Vue', 'Angular',
      'Node.js', 'Docker', 'Kubernetes', 'AWS', 'Linux', 'Git', 'MySQL', 'Redis',
      'Figma', 'Sketch', 'Photoshop', 'Excel', 'PPT',
      '项目管理', '需求分析', '数据分析', '用户研究', '竞品分析', 'A/B测试',
      '团队管理', '跨部门协作', '客户沟通', '方案设计', '架构设计',
      '内容运营', '活动策划', '社群运营', 'SEO', 'SEM',
    ];

    const requiredSkills = allSkills.filter(s => text.includes(s.toLowerCase()));

    // 提取岗位关键词（用作出题方向）
    const jobTypes = [];
    for (const [type, keywords] of Object.entries(JOB_KEYWORDS)) {
      if (keywords.some(kw => text.includes(kw.toLowerCase()))) {
        jobTypes.push(type);
      }
    }

    // 提取经验要求
    const expMatch = jdText.match(/(\d+)\s*(?:年|年以上)/);
    const experienceRequired = expMatch ? parseInt(expMatch[1]) : null;

    return {
      requiredSkills,
      jobTypes,
      experienceRequired,
      keywords: requiredSkills,
      hasJD: true,
    };
  }

  // 生成个性化问题（基于简历+JD+岗位名称）
  function generatePersonalizedQuestions(resumeInfo, jdInfo, jobName, jobType) {
    const personalized = [];

    // 基于岗位名称生成问题
    if (jobName) {
      personalized.push({
        id: 'personal_job_' + Date.now(),
        q: `你为什么想做${jobName}这个岗位？是什么吸引你的？`,
        difficulty: 1,
        dimension: '学习成长',
        tags: [jobType],
      });
      personalized.push({
        id: 'personal_job2_' + Date.now(),
        q: `你觉得自己做${jobName}最大的优势是什么？`,
        difficulty: 2,
        dimension: '沟通表达',
        tags: [jobType],
      });
      personalized.push({
        id: 'personal_job3_' + Date.now(),
        q: `你对${jobName}的日常工作是怎么理解的？`,
        difficulty: 1,
        dimension: '专业能力',
        tags: [jobType],
      });
    }

    // 如果简历提到某些技能，生成相关深度问题
    if (resumeInfo.skills.length > 0) {
      const skill = resumeInfo.skills[Math.floor(Math.random() * resumeInfo.skills.length)];
      personalized.push({
        id: 'personal_skill_' + Date.now(),
        q: `你简历里提到了${skill}，能说说你在这方面的具体经验吗？`,
        difficulty: 2,
        dimension: '专业能力',
        tags: [jobType],
      });
    }

    // 如果有工作年限，问相关问题
    if (resumeInfo.years) {
      personalized.push({
        id: 'personal_exp_' + Date.now(),
        q: `你有${resumeInfo.years}年工作经验，这段时间你最大的成长是什么？`,
        difficulty: 1,
        dimension: '学习成长',
        tags: [jobType],
      });
    }

    // 如果有公司经历，问相关问题
    if (resumeInfo.companies.length > 0) {
      personalized.push({
        id: 'personal_company_' + Date.now(),
        q: `你在${resumeInfo.companies[0]}主要负责什么？能分享一个你在那里的项目经历吗？`,
        difficulty: 2,
        dimension: '专业能力',
        tags: [jobType],
      });
    }

    // 如果JD有技能要求，问匹配度问题
    if (jdInfo.requiredSkills.length > 0) {
      const skill = jdInfo.requiredSkills[Math.floor(Math.random() * jdInfo.requiredSkills.length)];
      personalized.push({
        id: 'personal_jd_' + Date.now(),
        q: `这个岗位要求${skill}，你能说说你在这方面的经验吗？`,
        difficulty: 2,
        dimension: '专业能力',
        tags: [jobType],
      });
    }

    return personalized;
  }

  // ═══════════════════════════════════════════════════
  //  3. 评估引擎 — 多维度打分 + 决策
  // ═══════════════════════════════════════════════════

  function evaluateAnswer(answer, question, resumeInfo, refAnswerMap) {
    const text = (answer || '').trim();
    const len = text.length;

    // 基础分（长度）
    let baseScore = 0;
    if (len < 10) baseScore = 15;
    else if (len < 30) baseScore = 35;
    else if (len < 60) baseScore = 50;
    else if (len < 100) baseScore = 65;
    else if (len < 200) baseScore = 75;
    else baseScore = 85;

    // 结构加分
    let structureBonus = 0;
    const hasStructure = /第一|首先|其次|然后|最后|总结/.test(text) ||
                         /1\.|2\.|3\.|①|②|③/.test(text) ||
                         /因为|所以|但是|而且/.test(text);
    if (hasStructure) structureBonus += 10;

    // STAR加分
    const starBonus = analyzeSTAR(text);

    // 量化数据加分
    const quantBonus = analyzeQuantification(text);

    // 具体案例加分
    const exampleBonus = analyzeExamples(text);

    // 关键词匹配加分（简历相关）
    let keywordBonus = 0;
    if (resumeInfo && resumeInfo.keywords.length > 0) {
      const matched = resumeInfo.keywords.filter(kw => text.toLowerCase().includes(kw.toLowerCase()));
      keywordBonus = Math.min(matched.length * 3, 15);
    }

    // 参考答案对比加分（来自专业题库）— 智能分句覆盖率分析
    let refBonus = 0;
    let matchedKeyPoints = [];
    let missedKeyPoints = [];
    let refCoverage = 0; // 0-100 覆盖率
    let refSentenceCoverage = 0; // 参考答案句子覆盖率
    if (refAnswerMap && question.id && refAnswerMap[question.id]) {
      const ref = refAnswerMap[question.id];

      // ── 1. 评估要点（keyPoints）匹配 ──
      if (ref.keyPoints && ref.keyPoints.length > 0) {
        const kps = Array.isArray(ref.keyPoints) ? ref.keyPoints : String(ref.keyPoints).split(/[|｜]/);
        kps.forEach(function(kp) {
          if (!kp || !kp.trim()) return;
          // 将评估要点拆成2字以上关键词，检查是否被用户回答覆盖
          var keywords = kp.replace(/[，。！？、：；""''（）\(\)]/g, ' ').split(/\s+/).filter(function(w) { return w.length >= 2; });
          var matched = keywords.some(function(kw) { return text.includes(kw); });
          if (matched) {
            matchedKeyPoints.push(kp.trim());
          } else {
            missedKeyPoints.push(kp.trim());
          }
        });
        refCoverage = kps.length > 0 ? Math.round(matchedKeyPoints.length / kps.length * 100) : 0;
        refBonus = Math.min(matchedKeyPoints.length * 5, 25);
      }

      // ── 2. 参考答案（a）分句覆盖率 ──
      if (ref.a && ref.a.length > 10) {
        // 将参考答案按句号、分号、换行拆成句子
        var refSentences = ref.a.split(/[。；；\n]/).map(function(s) { return s.trim(); }).filter(function(s) { return s.length >= 6; });
        var coveredSentences = 0;
        refSentences.forEach(function(sentence) {
          // 取句子中的关键词（3字以上）
          var sentKeywords = sentence.replace(/[，。！？、：；""''（）\(\)123456789①②③④⑤]/g, ' ').split(/\s+/).filter(function(w) { return w.length >= 3; });
          // 句子中超过40%的关键词被覆盖则认为该句被覆盖
          var matchCount = sentKeywords.filter(function(kw) { return text.includes(kw); }).length;
          if (sentKeywords.length > 0 && matchCount / sentKeywords.length >= 0.4) {
            coveredSentences++;
          }
        });
        refSentenceCoverage = refSentences.length > 0 ? Math.round(coveredSentences / refSentences.length * 100) : 0;
        // 句子覆盖率额外加分（最高10分）
        refBonus += Math.min(Math.round(refSentenceCoverage / 10), 10);
      }
    }

    // 重复扣分
    let repeatPenalty = 0;
    // （这个需要在session级别检查，这里先留接口）

    const totalScore = Math.min(100, Math.max(10,
      baseScore + structureBonus + starBonus + quantBonus + exampleBonus + keywordBonus + refBonus
    ));

    // 判断等级
    let level, color;
    if (totalScore >= 80) { level = '优秀'; color = '#22c55e'; }
    else if (totalScore >= 60) { level = '良好'; color = '#3b82f6'; }
    else if (totalScore >= 40) { level = '一般'; color = '#f59e0b'; }
    else { level = '需改进'; color = '#ef4444'; }

    // 判断维度
    const dimension = question.dimension || '综合';

    // 判断下一步动作
    let action = 'next'; // 默认进入下一题
    if (totalScore < 40) {
      action = 'followup'; // 回答太差，追问
    } else if (len < 30 && Math.random() > 0.4) {
      action = 'followup'; // 回答太短，50%概率追问
    } else if (totalScore >= 40 && len < 60 && Math.random() > 0.6) {
      action = 'followup'; // 回答一般，30%概率追问
    }

    // 生成追问问题（如果需要）
    let followupQuestion = null;
    if (action === 'followup') {
      followupQuestion = generateFollowup(answer, question, resumeInfo);
    }

    return {
      score: totalScore,
      level,
      color,
      dimension,
      action,
      followupQuestion,
      analysis: {
        baseScore,
        structureBonus,
        starBonus,
        quantBonus,
        exampleBonus,
        keywordBonus,
        refBonus,
        matchedKeyPoints,
        missedKeyPoints,
        refCoverage,
        refSentenceCoverage,
      },
      feedback: generateFeedback(totalScore, text, question),
    };
  }

  function analyzeSTAR(text) {
    const hasSituation = /当时|那时候|之前|有一次|在[^\s]{2,6}(?:的时候|期间)/.test(text);
    const hasTask = /需要|要求|目标|任务|负责|要做/.test(text);
    const hasAction = /我做了|我通过|我采取|我决定|我负责|我主导|我协调/.test(text);
    const hasResult = /结果|最终|完成后|上线后|优化后|提升了?|增长了?|节省了?/.test(text);

    let score = 0;
    if (hasSituation) score += 2;
    if (hasTask) score += 2;
    if (hasAction) score += 3;
    if (hasResult) score += 3;
    return Math.min(score, 10);
  }

  function analyzeQuantification(text) {
    const patterns = /\d+[%％万元人天次个月年]|提升了?\d+|增长了?\d+|节省了?\d+|从\d+到\d+/g;
    const matches = text.match(patterns) || [];
    return Math.min(matches.length * 4, 12);
  }

  function analyzeExamples(text) {
    const hasExample = /比如|例如|举个例子|有一次|记得|当时/.test(text);
    const hasDetail = /具体来说|详细说说|那一次|那个时候/.test(text);
    return (hasExample ? 5 : 0) + (hasDetail ? 3 : 0);
  }

  function generateFollowup(answer, question, resumeInfo) {
    const text = (answer || '').trim();
    const len = text.length;

    // 根据回答内容选择追问方向
    if (len < 20) {
      return { q: '能再展开说说吗？给我讲一个具体的例子。', type: 'expand' };
    }

    const hasProject = /项目|产品|功能|上线|发布/.test(text);
    const hasData = /\d+[%％万元]/.test(text);
    const hasDifficulty = /困难|挑战|问题|难点/.test(text);
    const hasSuccess = /成功|完成|达成|效果/.test(text);

    if (hasProject && !hasData) {
      return { q: '这个项目的成果如何？有可以量化的数据吗？', type: 'quantify' };
    }
    if (hasDifficulty) {
      return { q: '你是怎么解决这个困难的？具体采取了什么措施？', type: 'solution' };
    }
    if (hasSuccess && !hasData) {
      return { q: '效果如何？能给个具体数字吗？', type: 'result' };
    }

    const followups = [
      { q: '能举一个你实际做过的例子吗？', type: 'example' },
      { q: '当时具体是什么情况？你做了什么？', type: 'detail' },
      { q: '结果怎么样？你从中学到了什么？', type: 'reflection' },
      { q: '如果现在让你重新来过，你会怎么做？', type: 'improvement' },
    ];

    return followups[Math.floor(Math.random() * followups.length)];
  }

  function generateFeedback(score, text, question) {
    const parts = [];

    if (score >= 80) {
      parts.push('回答得很好');
    } else if (score >= 60) {
      parts.push('回答还不错');
    } else if (score >= 40) {
      parts.push('回答还可以更充实');
    } else {
      parts.push('回答需要更多内容');
    }

    // 具体反馈
    if (text.length < 30) {
      parts.push('内容偏短，建议多说一些细节');
    }
    if (!/\d+/.test(text)) {
      parts.push('可以加入一些数据来支撑');
    }
    if (!/比如|例如|举个例子/.test(text)) {
      parts.push('举一个实际例子会更有说服力');
    }

    return parts.join('。');
  }

  // ═══════════════════════════════════════════════════
  //  4. 状态机 — 管理面试流程
  // ═══════════════════════════════════════════════════

  const PHASES = [
    {
      id: 'opening',
      label: '开场',
      targetRounds: 2,
      categories: ['self_intro'],
      questionCount: 2,
    },
    {
      id: 'background',
      label: '背景',
      targetRounds: 3,
      categories: ['career_gap', 'career_change', 'self_intro'],
      questionCount: 3,
    },
    {
      id: 'ability',
      label: '能力',
      targetRounds: 4,
      categories: ['professional', 'problem_solving'],
      questionCount: 4,
    },
    {
      id: 'behavior',
      label: '行为',
      targetRounds: 3,
      categories: ['behavioral', 'team_collab'],
      questionCount: 3,
    },
    {
      id: 'closing',
      label: '收尾',
      targetRounds: 2,
      categories: ['pressure', 'career_plan', 'closing'],
      questionCount: 2,
    },
  ];

  function createSession(jobName, resumeText, jdText) {
    // 分析简历和JD
    const resumeInfo = analyzeResume(resumeText);
    const jdInfo = analyzeJD(jdText);

    // 根据岗位名称匹配岗位类型
    const jobType = matchJobType(jobName);

    // 选择面试官（根据岗位类型）
    let personaKey = 'hr';
    if (jdInfo.jobTypes.includes('tech') || jobType === '数据分析' || jobType === '产品经理') personaKey = 'tech';
    else if (jdInfo.jobTypes.includes('management') || jobName.includes('主管') || jobName.includes('经理')) personaKey = 'manager';

    // 生成岗位专业问题（优先从新题库加载）
    let jobQuestions = JOB_QUESTIONS[jobType] || JOB_QUESTIONS['通用'];
    let positionQBData = null;
    if (QB) {
      positionQBData = QB.getPositionQuestions(jobName);
      if (positionQBData && positionQBData.length > 0) {
        // 使用新题库的题目覆盖旧的
        jobQuestions = {
          dimension: '专业能力',
          questions: positionQBData.map(function(q) {
            return { id: q.id, q: q.q, difficulty: q.difficulty, tags: [jobType], dimension: q.dimension || '专业能力' };
          })
        };
      }
    }

    // 生成个性化问题
    const personalizedQuestions = generatePersonalizedQuestions(resumeInfo, jdInfo, jobName, jobType);

    // 构建参考答案索引（从新题库）
    const refAnswerMap = {};
    if (QB && positionQBData) {
      positionQBData.forEach(function(q) {
        refAnswerMap[q.id] = { a: q.a, keyPoints: q.keyPoints, category: q.category };
      });
    }

    // 构建问题池
    const questionPool = {};
    for (const [catKey, catData] of Object.entries(QUESTION_BANK)) {
      questionPool[catKey] = [...catData.questions];
    }

    // 添加岗位专业问题到专业能力类别
    if (!questionPool['professional']) questionPool['professional'] = [];
    questionPool['professional'] = [
      ...jobQuestions.questions.map(q => ({ ...q, dimension: jobQuestions.dimension, tags: [jobType] })),
      ...personalizedQuestions,
      ...questionPool['professional'],
    ];

    return {
      jobName,
      jobType,
      resumeInfo,
      jdInfo,
      persona: PERSONAS[personaKey],
      personaKey,
      questionPool,
      refAnswerMap,
      phaseIndex: 0,
      phaseRounds: 0,
      round: 0,
      maxRounds: 15,
      askedIds: new Set(),
      answers: [],
      competencyScores: {},
      startTime: Date.now(),
      _usedFollowups: new Set(),
    };
  }

  function getCurrentPhase(session) {
    return PHASES[session.phaseIndex] || PHASES[PHASES.length - 1];
  }

  function pickQuestion(session) {
    const phase = getCurrentPhase(session);
    const categories = phase.categories;

    // 获取薄弱维度（间隔重复）
    const weakDims = getWeakDimensions();
    const weakDimNames = weakDims.map(w => w.dimension);

    // 从当前阶段的类别中随机选一个未问过的题
    const candidates = [];
    for (const catKey of categories) {
      const questions = session.questionPool[catKey] || [];
      for (const q of questions) {
        if (!session.askedIds.has(q.id)) {
          candidates.push(q);
        }
      }
    }

    if (candidates.length === 0) {
      // 当前阶段题目用完了，尝试其他类别
      for (const [catKey, questions] of Object.entries(session.questionPool)) {
        for (const q of questions) {
          if (!session.askedIds.has(q.id)) {
            candidates.push(q);
          }
        }
      }
    }

    if (candidates.length === 0) return null;

    // 按难度排序，优先选中等难度
    candidates.sort((a, b) => {
      const targetDifficulty = session.round < 5 ? 1 : session.round < 10 ? 2 : 3;
      const diffA = Math.abs(a.difficulty - targetDifficulty);
      const diffB = Math.abs(b.difficulty - targetDifficulty);
      // 如果维度是薄弱维度，优先选择
      const weakBonusA = weakDimNames.includes(a.dimension) ? -1 : 0;
      const weakBonusB = weakDimNames.includes(b.dimension) ? -1 : 0;
      return (diffA + weakBonusA) - (diffB + weakBonusB);
    });

    // 从前5个候选中随机选1个
    const pick = candidates[Math.floor(Math.random() * Math.min(5, candidates.length))];
    return pick;
  }

  function advancePhase(session) {
    session.phaseRounds = 0;
    if (session.phaseIndex < PHASES.length - 1) {
      session.phaseIndex++;
    }
  }

  function getPhaseTransitionMessage(session) {
    const transitions = {
      background: '好的，了解了基本情况。接下来我想更深入地了解一下你的背景——',
      ability: '嗯，背景方面我大概了解了。下面我想聊聊你的专业能力——',
      behavior: '专业能力方面我有了初步了解。接下来我想问问你的实际工作经历——',
      closing: '好的，今天聊得差不多了。最后我想再确认几个问题——',
    };
    const phase = getCurrentPhase(session);
    return transitions[phase.id] || '';
  }

  // ═══════════════════════════════════════════════════
  //  5. 主控制器 — 驱动整个面试流程
  // ═══════════════════════════════════════════════════

  function startInterview(session) {
    const persona = session.persona;
    const question = pickQuestion(session);

    if (!question) {
      return { message: '抱歉，暂时没有合适的问题了。', isFinished: true };
    }

    session.askedIds.add(question.id);
    session.round++;
    session.phaseRounds++;

    // 自定义开场白，加入岗位名称
    const jobName = session.jobName || '这个岗位';
    const greeting = persona.greeting.replace('今天的面试', `${jobName}岗位的面试`);

    return {
      message: greeting + '\n\n' + question.q,
      question,
      phase: getCurrentPhase(session).label,
      round: session.round,
      isFinished: false,
    };
  }

  function processAnswer(session, answer, lastQuestion) {
    const evaluation = evaluateAnswer(answer, lastQuestion, session.resumeInfo, session.refAnswerMap);

    // 记录回答
    session.answers.push({
      question: lastQuestion,
      answer,
      evaluation,
      round: session.round,
      phase: getCurrentPhase(session).id,
    });

    // 更新胜任力分数
    const dim = evaluation.dimension;
    if (!session.competencyScores[dim]) session.competencyScores[dim] = [];
    session.competencyScores[dim].push(evaluation.score);

    const persona = session.persona;
    let aiMessage = '';
    let nextQuestion = null;
    let isFinished = false;
    let phaseTransition = '';

    // 决定下一步
    if (evaluation.action === 'followup' && evaluation.followupQuestion) {
      // 追问
      const reaction = evaluation.score >= 70
        ? persona.reactions.good[Math.floor(Math.random() * persona.reactions.good.length)]
        : persona.reactions.mid[Math.floor(Math.random() * persona.reactions.mid.length)];

      aiMessage = reaction + '\n\n' + evaluation.followupQuestion.q;
      nextQuestion = {
        id: 'followup_' + Date.now(),
        q: evaluation.followupQuestion.q,
        dimension: evaluation.dimension,
        difficulty: lastQuestion.difficulty,
        tags: ['追问'],
      };
      session.askedIds.add(nextQuestion.id);
      session.round++;
      session.phaseRounds++;
    } else {
      // 进入下一题
      const reaction = evaluation.score >= 75
        ? persona.reactions.good[Math.floor(Math.random() * persona.reactions.good.length)]
        : evaluation.score >= 50
          ? persona.reactions.mid[Math.floor(Math.random() * persona.reactions.mid.length)]
          : persona.reactions.weak[Math.floor(Math.random() * persona.reactions.weak.length)];

      // 检查是否需要推进阶段
      const phase = getCurrentPhase(session);
      if (session.phaseRounds >= phase.targetRounds && session.phaseIndex < PHASES.length - 1) {
        advancePhase(session);
        phaseTransition = getPhaseTransitionMessage(session);
      }

      // 获取下一题
      nextQuestion = pickQuestion(session);

      if (!nextQuestion) {
        // 面试结束
        aiMessage = reaction + '\n\n' + persona.transitions[Math.floor(Math.random() * persona.transitions.length)] + '\n\n' + '好的，今天的面试就到这里。感谢你的参与，正在为你生成评估报告，请稍候...';
        isFinished = true;
      } else {
        session.askedIds.add(nextQuestion.id);
        session.round++;
        session.phaseRounds++;

        const transition = phaseTransition || persona.transitions[Math.floor(Math.random() * persona.transitions.length)];
        aiMessage = reaction + '\n\n' + transition + '\n\n' + nextQuestion.q;
      }
    }

    return {
      message: aiMessage,
      evaluation,
      question: nextQuestion,
      phase: getCurrentPhase(session).label,
      round: session.round,
      isFinished,
    };
  }

  // ═══════════════════════════════════════════════════
  //  6. 报告生成器
  // ═══════════════════════════════════════════════════

  function generateReport(session) {
    if (session.answers.length === 0) {
      return { error: '没有回答记录' };
    }

    const totalScore = Math.round(
      session.answers.reduce((s, a) => s + a.evaluation.score, 0) / session.answers.length
    );

    const duration = Math.round((Date.now() - session.startTime) / 1000);

    // 维度统计
    const dimensionScores = {};
    for (const [dim, scores] of Object.entries(session.competencyScores)) {
      dimensionScores[dim] = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
    }

    // 填充缺失维度
    for (const dim of Object.keys(DIMENSIONS)) {
      if (!dimensionScores[dim]) {
        dimensionScores[dim] = 50; // 默认分
      }
    }

    // 加权总分
    const weightedTotal = Math.round(
      Object.entries(DIMENSIONS).reduce((sum, [dim, config]) => {
        return sum + (dimensionScores[dim] || 50) * config.weight;
      }, 0)
    );

    // 等级
    let level, color, suggestion;
    if (weightedTotal >= 80) {
      level = '优秀';
      color = '#22c55e';
      suggestion = '表现出色！建议在面试中继续保持这种状态，注意薪资谈判技巧。';
    } else if (weightedTotal >= 60) {
      level = '良好';
      color = '#3b82f6';
      suggestion = '整体不错，建议针对薄弱维度做专项准备，多准备量化数据和具体案例。';
    } else if (weightedTotal >= 40) {
      level = '一般';
      color = '#f59e0b';
      suggestion = '有一定基础但需要提升。建议系统梳理过往经历，准备STAR格式的回答。';
    } else {
      level = '需加强';
      color = '#ef4444';
      suggestion = '建议充分准备后再面试。重点梳理工作经历中的亮点和数据。';
    }

    // 优势和不足
    const sortedDims = Object.entries(dimensionScores).sort((a, b) => b[1] - a[1]);
    const strengths = sortedDims.slice(0, 2).map(([dim, score]) => ({
      dimension: dim,
      score,
      comment: score >= 70 ? '表现良好' : '还有提升空间',
    }));
    const weaknesses = sortedDims.slice(-2).map(([dim, score]) => ({
      dimension: dim,
      score,
      comment: score < 60 ? '需要重点提升' : '可以进一步加强',
    }));

    // STAR分析
    let starComplete = 0, starPartial = 0, starMissing = 0;
    for (const a of session.answers) {
      const text = a.answer || '';
      const hasS = /当时|那时候|之前|有一次/.test(text);
      const hasT = /需要|要求|目标|任务/.test(text);
      const hasA = /我做了|我通过|我采取|我决定/.test(text);
      const hasR = /结果|最终|完成后|提升了?|增长了?/.test(text);
      if (hasS && hasT && hasA && hasR) starComplete++;
      else if (hasS || hasT || hasA || hasR) starPartial++;
      else starMissing++;
    }

    // 置信度分析
    const confidenceAnalysis = analyzeConfidence(session);

    return {
      jobName: session.jobName,
      totalScore: weightedTotal,
      level,
      color,
      suggestion,
      duration: `${Math.floor(duration / 60)}分${duration % 60}秒`,
      totalQuestions: session.answers.length,
      dimensionScores,
      dimensionConfig: DIMENSIONS,
      strengths,
      weaknesses,
      starAnalysis: { complete: starComplete, partial: starPartial, missing: starMissing },
      confidenceAnalysis,
      details: session.answers.map(a => {
        const refData = (session.refAnswerMap && a.question.id) ? session.refAnswerMap[a.question.id] : null;
        return {
          question: a.question.q,
          category: a.question.tags?.[0] || (refData ? refData.category : '未分类'),
          answer: a.answer,
          score: a.evaluation.score,
          level: a.evaluation.level,
          dimension: a.evaluation.dimension,
          feedback: a.evaluation.feedback,
          dimensionScores: a.evaluation.analysis,
          referenceAnswer: refData ? refData.a : null,
          matchedKeyPoints: a.evaluation.analysis.matchedKeyPoints || [],
          missedKeyPoints: a.evaluation.analysis.missedKeyPoints || [],
          allKeyPoints: refData ? (Array.isArray(refData.keyPoints) ? refData.keyPoints : String(refData.keyPoints).split(/[|｜]/)) : [],
          refCoverage: a.evaluation.analysis.refCoverage || 0,
          refSentenceCoverage: a.evaluation.analysis.refSentenceCoverage || 0,
        };
      }),
    };
  }

  // ═══════════════════════════════════════════════════
  //  7. 置信度分析模块
  // ═══════════════════════════════════════════════════

  function analyzeConfidence(session) {
    let highConfidence = 0;
    let mediumConfidence = 0;
    let lowConfidence = 0;

    for (const a of session.answers) {
      const text = (a.answer || '').trim();
      const len = text.length;
      const score = a.evaluation.score;

      // 高置信：回答详细 + 有数据 + 有案例 + 高分
      const hasData = /\d+[%％万元]/.test(text);
      const hasExample = /比如|例如|举个例子|有一次/.test(text);
      const hasSTAR = /当时|那时候|之前/.test(text) && /我做了|我通过|我采取/.test(text) && /结果|最终|完成后/.test(text);

      if (len >= 80 && score >= 70 && (hasData || hasExample || hasSTAR)) {
        highConfidence++;
      } else if (len >= 30 && score >= 40) {
        mediumConfidence++;
      } else {
        lowConfidence++;
      }
    }

    const total = session.answers.length || 1;
    return {
      high: Math.round(highConfidence / total * 100),
      medium: Math.round(mediumConfidence / total * 100),
      low: Math.round(lowConfidence / total * 100),
      label: highConfidence > total * 0.5 ? '自信' : lowConfidence > total * 0.3 ? '需增强' : '适中',
    };
  }

  // ═══════════════════════════════════════════════════
  //  8. 间隔重复模块 — 跟踪薄弱维度
  // ═══════════════════════════════════════════════════

  const STORAGE_KEY = 'careerstart_interview_history';

  function getWeakDimensions() {
    try {
      const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (history.length === 0) return [];

      // 统计每个维度的平均分
      const dimTotals = {};
      const dimCounts = {};
      for (const session of history) {
        for (const [dim, score] of Object.entries(session.dimensionScores || {})) {
          dimTotals[dim] = (dimTotals[dim] || 0) + score;
          dimCounts[dim] = (dimCounts[dim] || 0) + 1;
        }
      }

      // 找出平均分低于60的维度
      const weak = [];
      for (const [dim, total] of Object.entries(dimTotals)) {
        const avg = total / (dimCounts[dim] || 1);
        if (avg < 60) {
          weak.push({ dimension: dim, avgScore: Math.round(avg) });
        }
      }

      return weak.sort((a, b) => a.avgScore - b.avgScore);
    } catch {
      return [];
    }
  }

  function recordSessionToHistory(report) {
    try {
      const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      history.push({
        date: new Date().toISOString(),
        jobName: report.jobName,
        totalScore: report.totalScore,
        level: report.level,
        dimensionScores: report.dimensionScores,
        duration: report.duration,
        totalQuestions: report.totalQuestions,
      });
      // 只保留最近20次
      if (history.length > 20) history.splice(0, history.length - 20);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      // ignore
    }
  }

  function getInterviewHistory() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  // ═══════════════════════════════════════════════════
  //  公开接口
  // ═══════════════════════════════════════════════════

  return {
    // 分析
    analyzeResume,
    analyzeJD,
    // 会话
    createSession,
    startInterview,
    processAnswer,
    // 报告
    generateReport,
    recordSessionToHistory,
    getWeakDimensions,
    getInterviewHistory,
    // 数据（供外部使用）
    QUESTION_BANK,
    DIMENSIONS,
    PERSONAS,
    PHASES,
  };

}));
