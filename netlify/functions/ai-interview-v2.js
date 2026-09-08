/**
 * AI 模拟面试后端 v2.0
 * 基于 InterviewForge 架构，使用 DeepSeek API
 * 
 * 核心模块：
 * 1. RAG 问题选择 — 从中文题库按维度×难度动态选题
 * 2. 多轮对话状态机 — 管理面试流程
 * 3. 评估引擎 — DeepSeek 评分 + 反馈
 * 4. 报告生成 — 结构化评估报告
 */

const https = require('https');

// ═══════════════════════════════════════════════════
//  配置
// ═══════════════════════════════════════════════════

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

// ═══════════════════════════════════════════════════
//  中文题库 — 按维度组织（从 interview-engine.js 提取）
// ═══════════════════════════════════════════════════

const QUESTION_BANK = {
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
  behavioral: {
    dimension: '问题解决',
    questions: [
      { id: 'b1', q: '说一个你顶住压力完成任务的经历，当时压力来自哪里？', difficulty: 2, tags: ['通用'] },
      { id: 'b2', q: '有没有一次你主动承担了额外的责任？结果怎么样？', difficulty: 2, tags: ['通用'] },
      { id: 'b3', q: '讲一个你面对不确定性仍然做出决定的例子。', difficulty: 3, tags: ['通用'] },
      { id: 'b4', q: '说说你最有成就感的一次团队合作，你做了什么？', difficulty: 2, tags: ['通用'] },
      { id: 'b5', q: '有没有一次你的方案被否定了？你怎么办的？', difficulty: 2, tags: ['通用'] },
      { id: 'b6', q: '说一个你通过沟通化解矛盾的例子。', difficulty: 2, tags: ['通用'] },
    ],
  },
  growth: {
    dimension: '学习成长',
    questions: [
      { id: 'g1', q: '你最近学到的一个新技能是什么？怎么学的？', difficulty: 1, tags: ['通用'] },
      { id: 'g2', q: '有没有哪个同事或领导对你职业发展影响很大？说说。', difficulty: 1, tags: ['通用'] },
      { id: 'g3', q: '你觉得3年后的自己会是什么样子？', difficulty: 2, tags: ['通用'] },
      { id: 'g4', q: '你最近读的一本书或看的一个课程是什么？有什么收获？', difficulty: 1, tags: ['通用'] },
      { id: 'g5', q: '你有没有参加过什么培训或认证？对工作有帮助吗？', difficulty: 1, tags: ['通用'] },
      { id: 'g6', q: '你怎么看待「35岁危机」？你有什么准备？', difficulty: 2, tags: ['35+'] },
    ],
  },
  stress: {
    dimension: '抗压韧性',
    questions: [
      { id: 's1', q: '说一个你同时处理多个紧急任务的经历，你怎么排序的？', difficulty: 2, tags: ['通用'] },
      { id: 's2', q: '你有没有因为工作压力影响过生活？怎么调整的？', difficulty: 2, tags: ['通用'] },
      { id: 's3', q: '面对不合理的deadline，你会怎么做？', difficulty: 2, tags: ['通用'] },
      { id: 's4', q: '说一个你失败后重新站起来的经历。', difficulty: 3, tags: ['通用'] },
      { id: 's5', q: '你怎么看待加班？能接受什么程度的加班？', difficulty: 1, tags: ['通用'] },
      { id: 's6', q: '上一份工作让你最焦虑的事情是什么？你怎么应对的？', difficulty: 2, tags: ['通用'] },
    ],
  },
};

// ═══════════════════════════════════════════════════
//  维度定义 — 6维评估模型
// ═══════════════════════════════════════════════════

const DIMENSIONS = {
  '专业能力': { weight: 0.25, icon: '💻', color: '#6366f1' },
  '沟通表达': { weight: 0.20, icon: '💬', color: '#8b5cf6' },
  '问题解决': { weight: 0.20, icon: '🧩', color: '#06b6d4' },
  '团队协作': { weight: 0.15, icon: '🤝', color: '#10b981' },
  '学习成长': { weight: 0.10, icon: '📚', color: '#f59e0b' },
  '抗压韧性': { weight: 0.10, icon: '💪', color: '#ef4444' },
};

// ═══════════════════════════════════════════════════
//  面试阶段 — 状态机
// ═══════════════════════════════════════════════════

const PHASES = [
  { id: 'opening', name: '开场', questionCategories: ['self_intro'], questionCount: 2 },
  { id: 'background', name: '背景探索', questionCategories: ['career_gap', 'career_change'], questionCount: 3 },
  { id: 'competency', name: '能力考察', questionCategories: ['professional', 'problem_solving'], questionCount: 5 },
  { id: 'behavioral', name: '行为面试', questionCategories: ['behavioral', 'team_collab'], questionCount: 3 },
  { id: 'closing', name: '收尾', questionCategories: ['growth', 'stress'], questionCount: 2 },
];

// ═══════════════════════════════════════════════════
//  DeepSeek API 调用
// ═══════════════════════════════════════════════════

function callDeepSeek(messages, options = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: options.model || 'deepseek-chat',
      messages,
      max_tokens: options.max_tokens || 1000,
      temperature: options.temperature || 0.7,
      response_format: options.json ? { type: 'json_object' } : undefined,
    });

    const req = https.request({
      hostname: 'api.deepseek.com',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(new Error(parsed.error.message || 'DeepSeek API error'));
          } else {
            resolve(parsed.choices[0].message.content);
          }
        } catch (e) {
          reject(new Error(`Failed to parse DeepSeek response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('DeepSeek API timeout'));
    });
    req.write(body);
    req.end();
  });
}

// ═══════════════════════════════════════════════════
//  RAG 问题选择 — 根据阶段、用户标签、历史选题动态选题
// ═══════════════════════════════════════════════════

function selectQuestion(phase, userTags, askedIds, difficulty) {
  const categories = phase.questionCategories;
  let candidates = [];

  for (const cat of categories) {
    const bank = QUESTION_BANK[cat];
    if (!bank) continue;
    for (const q of bank.questions) {
      if (askedIds.includes(q.id)) continue;
      // 标签匹配：如果用户有特定标签，优先选匹配的题
      if (userTags.length > 0 && q.tags.some(t => t !== '通用' && userTags.includes(t))) {
        candidates.push({ ...q, dimension: bank.dimension, priority: 3 });
      } else if (q.tags.includes('通用')) {
        candidates.push({ ...q, dimension: bank.dimension, priority: 1 });
      }
    }
  }

  if (candidates.length === 0) {
    // fallback: 从所有题库中选
    for (const cat of Object.keys(QUESTION_BANK)) {
      for (const q of QUESTION_BANK[cat].questions) {
        if (!askedIds.includes(q.id)) {
          candidates.push({ ...q, dimension: QUESTION_BANK[cat].dimension, priority: 0 });
        }
      }
    }
  }

  if (candidates.length === 0) return null;

  // 按优先级和难度排序
  candidates.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return Math.abs(a.difficulty - difficulty) - Math.abs(b.difficulty - difficulty);
  });

  // 从前3个中随机选1个（增加随机性）
  const top = candidates.slice(0, Math.min(3, candidates.length));
  return top[Math.floor(Math.random() * top.length)];
}

// ═══════════════════════════════════════════════════
//  评估引擎 — DeepSeek 评分
// ═══════════════════════════════════════════════════

async function evaluateAnswer(question, answer, resumeContext) {
  const prompt = `你是一位资深HR面试官，正在评估候选人的回答。

面试问题：${question.q}
问题维度：${question.dimension}
候选人回答：${answer}
${resumeContext ? `候选人背景：${resumeContext}` : ''}

请评估这个回答，返回JSON格式：
{
  "score": 0-100的整数分数,
  "level": "优秀/良好/一般/需改进",
  "dimension": "${question.dimension}",
  "feedback": "50字以内的具体反馈",
  "analysis": {
    "structure": "回答结构评价",
    "depth": "内容深度评价",
    "example": "是否有具体例子"
  },
  "suggestion": "改进建议"
}`;

  try {
    const result = await callDeepSeek([
      { role: 'system', content: '你是资深HR面试官，擅长评估候选人回答质量。请严格返回JSON格式。' },
      { role: 'user', content: prompt },
    ], { json: true, max_tokens: 500 });

    const evaluation = JSON.parse(result);
    // 确保分数在合理范围
    evaluation.score = Math.max(20, Math.min(100, evaluation.score || 70));
    return evaluation;
  } catch (e) {
    // fallback 评分
    return {
      score: 70,
      level: '良好',
      dimension: question.dimension,
      feedback: '回答有一定内容，可以更深入展开',
      analysis: { structure: '一般', depth: '一般', example: '未明确' },
      suggestion: '建议用具体案例支撑观点',
    };
  }
}

// ═══════════════════════════════════════════════════
//  AI 追问生成 — 基于回答质量动态追问
// ═══════════════════════════════════════════════════

async function generateFollowUp(question, answer, evaluation, resumeContext) {
  const prompt = `你是资深HR面试官。候选人刚回答了一个问题，你需要决定是否追问。

问题：${question.q}
回答：${answer}
评分：${evaluation.score}/100 - ${evaluation.feedback}

如果回答不够深入（分数<75），生成一个追问来深入了解。
如果回答已经很好（分数>=75），不要追问。

返回JSON格式：
{
  "shouldFollowUp": true/false,
  "followUpQuestion": "追问的问题（如果shouldFollowUp=true）"
}`;

  try {
    const result = await callDeepSeek([
      { role: 'system', content: '你是资深HR面试官。请严格返回JSON格式。' },
      { role: 'user', content: prompt },
    ], { json: true, max_tokens: 200 });

    return JSON.parse(result);
  } catch (e) {
    return { shouldFollowUp: false };
  }
}

// ═══════════════════════════════════════════════════
//  报告生成 — 多维度评估
// ═══════════════════════════════════════════════════

async function generateReport(answers, role) {
  const questionsSummary = answers.map(a =>
    `问题：${a.question.q}\n维度：${a.question.dimension}\n回答：${a.answer}\n分数：${a.evaluation.score}`
  ).join('\n\n');

  const prompt = `你是资深职业顾问，请根据面试结果生成评估报告。

目标岗位：${role || '未指定'}

面试记录：
${questionsSummary}

请返回JSON格式：
{
  "totalScore": 0-100的总分,
  "dimensionScores": {
    "专业能力": 0-100,
    "沟通表达": 0-100,
    "问题解决": 0-100,
    "团队协作": 0-100,
    "学习成长": 0-100,
    "抗压韧性": 0-100
  },
  "strengths": ["优势1", "优势2"],
  "weaknesses": ["待提升1", "待提升2"],
  "suggestions": ["建议1", "建议2", "建议3"],
  "summary": "100字以内的整体评价"
}`;

  try {
    const result = await callDeepSeek([
      { role: 'system', content: '你是资深职业顾问。请严格返回JSON格式。' },
      { role: 'user', content: prompt },
    ], { json: true, max_tokens: 800 });

    const report = JSON.parse(result);
    // 确保所有维度都有分数
    const defaultScores = {
      '专业能力': 70, '沟通表达': 70, '问题解决': 70,
      '团队协作': 70, '学习成长': 70, '抗压韧性': 70,
    };
    report.dimensionScores = { ...defaultScores, ...report.dimensionScores };
    return report;
  } catch (e) {
    // fallback 报告
    const avgScore = Math.round(answers.reduce((s, a) => s + a.evaluation.score, 0) / answers.length);
    return {
      totalScore: avgScore,
      dimensionScores: {
        '专业能力': avgScore, '沟通表达': avgScore, '问题解决': avgScore,
        '团队协作': avgScore, '学习成长': avgScore, '抗压韧性': avgScore,
      },
      strengths: ['有基本的沟通能力', '愿意参与面试'],
      weaknesses: ['回答可以更深入', '建议增加具体案例'],
      suggestions: ['准备更多具体工作案例', '练习结构化表达', '了解目标公司和岗位'],
      summary: '整体表现中等，建议加强案例准备和结构化表达。',
    };
  }
}

// ═══════════════════════════════════════════════════
//  Netlify Function Handler
// ═══════════════════════════════════════════════════

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const body = JSON.parse(event.body);
    const { action, state, answer, role, resumeContext, userTags } = body;

    // ── 开始面试 ──
    if (action === 'start') {
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const askedIds = [];
      const tags = userTags || [];
      const difficulty = 2; // 默认中等难度

      // 选第一题（开场阶段）
      const phase = PHASES[0];
      const question = selectQuestion(phase, tags, askedIds, difficulty);

      if (!question) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: '题库为空' }) };
      }

      const sessionState = {
        sessionId,
        role: role || '',
        resumeContext: resumeContext || '',
        userTags: tags,
        currentPhase: 0,
        questionCount: 0,
        maxQuestions: 15,
        askedIds: [question.id],
        answers: [],
        currentQuestion: question,
        competencyScores: {
          '专业能力': [], '沟通表达': [], '问题解决': [],
          '团队协作': [], '学习成长': [], '抗压韧性': [],
        },
      };

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          sessionId,
          question,
          phase: phase.name,
          phaseIndex: 0,
          questionNumber: 1,
          maxQuestions: 15,
          state: sessionState,
        }),
      };
    }

    // ── 提交回答 ──
    if (action === 'answer') {
      const sessionState = state;
      if (!sessionState || !answer) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: '缺少 state 或 answer' }) };
      }

      // 评估回答
      const evaluation = await evaluateAnswer(
        sessionState.currentQuestion,
        answer,
        sessionState.resumeContext
      );

      // 记录回答
      sessionState.answers.push({
        question: sessionState.currentQuestion,
        answer,
        evaluation,
      });
      sessionState.competencyScores[evaluation.dimension]?.push(evaluation.score);
      sessionState.questionCount++;

      // 检查是否需要追问
      let followUp = null;
      if (evaluation.score < 75 && sessionState.questionCount < sessionState.maxQuestions) {
        followUp = await generateFollowUp(
          sessionState.currentQuestion,
          answer,
          evaluation,
          sessionState.resumeContext
        );
      }

      // 判断是否进入下一阶段
      let nextQuestion = null;
      let nextPhase = null;
      let nextPhaseIndex = sessionState.currentPhase;
      let isFinished = false;

      if (sessionState.questionCount >= sessionState.maxQuestions) {
        // 面试结束，生成报告
        isFinished = true;
      } else if (followUp?.shouldFollowUp && followUp.followUpQuestion) {
        // 追问
        nextQuestion = {
          id: `fu_${sessionState.questionCount}`,
          q: followUp.followUpQuestion,
          dimension: sessionState.currentQuestion.dimension,
          difficulty: sessionState.currentQuestion.difficulty,
          tags: ['追问'],
          isFollowUp: true,
        };
        nextPhase = PHASES[sessionState.currentPhase].name;
      } else {
        // 进入下一题或下一阶段
        const currentPhase = PHASES[sessionState.currentPhase];
        const phaseQuestionCount = sessionState.answers.filter(
          a => PHASES[sessionState.currentPhase].questionCategories.includes(
            Object.keys(QUESTION_BANK).find(k => QUESTION_BANK[k].dimension === a.question.dimension)
          )
        ).length;

        if (phaseQuestionCount >= currentPhase.questionCount && sessionState.currentPhase < PHASES.length - 1) {
          // 进入下一阶段
          nextPhaseIndex = sessionState.currentPhase + 1;
          sessionState.currentPhase = nextPhaseIndex;
          nextPhase = PHASES[nextPhaseIndex].name;
        }

        nextQuestion = selectQuestion(
          PHASES[sessionState.currentPhase],
          sessionState.userTags,
          sessionState.askedIds,
          2
        );

        if (nextQuestion) {
          sessionState.askedIds.push(nextQuestion.id);
        }
      }

      // 计算当前进度
      const progress = Math.round((sessionState.questionCount / sessionState.maxQuestions) * 100);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          evaluation,
          followUp: followUp?.shouldFollowUp ? followUp : null,
          nextQuestion,
          phase: nextPhase || PHASES[sessionState.currentPhase].name,
          phaseIndex: nextPhaseIndex,
          questionNumber: sessionState.questionCount + 1,
          maxQuestions: sessionState.maxQuestions,
          progress,
          isFinished,
          state: sessionState,
        }),
      };
    }

    // ── 生成报告 ──
    if (action === 'report') {
      const sessionState = state;
      if (!sessionState || !sessionState.answers) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: '缺少 state' }) };
      }

      const report = await generateReport(sessionState.answers, sessionState.role);
      report.questions = sessionState.answers;
      report.sessionId = sessionState.sessionId;
      report.role = sessionState.role;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ report }),
      };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: '未知 action' }) };

  } catch (e) {
    console.error('Interview API error:', e);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: e.message || 'Internal server error' }),
    };
  }
};
