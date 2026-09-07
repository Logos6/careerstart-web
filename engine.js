// Web 网页端通用计算逻辑与数据接口
// 完全沿用原生 engine.js 的 6维算法、能力匹配、年龄歧视检测等核心逻辑

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./data.js'));
  } else {
    root.CareerEngine = factory(root.CareerData);
  }
}(typeof self !== 'undefined' ? self : this, function (D) {

  const INTERESTS = D.INTERESTS;
  const SKILL_GROUPS = D.SKILL_GROUPS;
  const TRAITS = D.TRAITS;
  const PREF_ITEMS = D.PREF_ITEMS;
  const JOBS = D.JOBS;
  const COURSES = D.COURSES;
  const PERSONAS = D.PERSONAS;
  const STEP_DEFS = D.STEP_DEFS;
  const PERSONA_STEPS = D.PERSONA_STEPS;

  const ALL_SKILLS = SKILL_GROUPS.flatMap(g => g.items);
  const SKILL_LABELS = Object.fromEntries(ALL_SKILLS.map(x => [x.id, x.label]));
  const PERSONA_NAMES = { mid: "35+ 重新出发", mom: "宝妈重返职场" };

  function scoreJob(job, a) {
    let interest = 0;
    if (a.interests.length) {
      let sum = 0, hit = 0;
      for (const id of a.interests) {
        const w = job.fit.interests[id] || 0;
        if (w > 0) { sum += w; hit++; }
      }
      const cover = hit / a.interests.length;
      const strength = hit ? sum / hit : 0;
      interest = strength * (0.55 + 0.45 * cover);
    }
    let skill = 0;
    if (a.skills.length) {
      let sum = 0;
      for (const id of a.skills) sum += job.fit.skills[id] || 0;
      skill = Math.min(1, sum / Math.max(2, a.skills.length * 0.8));
    }
    let trait = 0, wSum = 0;
    for (const t of TRAITS) {
      const w = job.fit.traits[t.id] || 0.3;
      trait += (a.traits[t.id] / 10) * w;
      wSum += w;
    }
    trait /= wSum;
    let pref = 0.5;
    if (a.prefs.length) {
      let sum = 0;
      for (const id of a.prefs) sum += job.fit.prefs[id] || 0;
      pref = Math.min(1, sum / a.prefs.length);
    }
    const persona = a.persona ? job.persona[a.persona] : 0.7;
    const total = interest * 0.35 + skill * 0.25 + trait * 0.20 + pref * 0.15 + persona * 0.05;
    return { total: Math.round(total * 100), parts: { interest, skill, trait, pref, persona } };
  }

  function buildReport(a) {
    const scored = JOBS.map(j => ({ job: j, ...scoreJob(j, a) }))
      .sort((x, y) => y.total - x.total);
    const top1 = scored[0];
    const top1Major = top1.job.cat.split(" ")[0];
    const alt = scored.find(s => s.job.cat.split(" ")[0] !== top1Major && s.total >= 55) || scored[3];
    return {
      time: Date.now(),
      persona: a.persona,
      interests: [...a.interests],
      skills: [...a.skills],
      traits: { ...a.traits },
      prefs: [...a.prefs],
      top: scored.slice(0, 3),
      alt,
    };
  }

  function gapSkills(report) {
    const j = report && report.top && report.top[0] ? report.top[0].job : null;
    if (!j) return [];
    return Object.entries(j.fit.skills)
      .filter(([, w]) => w >= 0.4)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => ALL_SKILLS.find(x => x.id === id))
      .filter(Boolean);
  }

  function gapCoursePlan(missing) {
    if (!missing || !missing.length) return [];
    return COURSES
      .map(c => ({ c, hits: c.skills.filter(s => missing.includes(s)).length }))
      .filter(x => x.hits > 0)
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 3)
      .map(x => x.c);
  }

  function reasonText(a, m) {
    const j = m.job, out = [];
    const hitInterests = a.interests
      .filter(id => (j.fit.interests[id] || 0) >= 0.6)
      .map(id => INTERESTS.find(x => x.id === id)?.label);
    if (hitInterests.length) out.push(`你的兴趣「${hitInterests.slice(0, 2).join("、")}」与该职位高度重合`);
    const hitSkills = a.skills
      .filter(id => (j.fit.skills[id] || 0) >= 0.6)
      .map(id => SKILL_LABELS[id]);
    if (hitSkills.length) out.push(`你已掌握所需技能：${hitSkills.slice(0, 3).join("、")}`);
    const topTraits = TRAITS
      .filter(t => (j.fit.traits[t.id] || 0) >= 0.8 && a.traits[t.id] >= 7)
      .map(t => t.label);
    if (topTraits.length) out.push(`你的「${topTraits.slice(0, 2).join("、")}」优势正是这个岗位的核心要求`);
    const hitPrefs = a.prefs
      .filter(id => (j.fit.prefs[id] || 0) >= 0.7)
      .map(id => PREF_ITEMS.find(x => x.id === id)?.label);
    if (hitPrefs.length) out.push(`符合你「${hitPrefs[0]}」的求职偏好`);
    if (a.persona && j.persona[a.persona] >= 0.85) {
      const personaMsg = {
        mid: "该职位看重阅历积累，经验是加分项",
        mom: "该职位时间弹性，适合兼顾家庭",
      };
      if (personaMsg[a.persona]) out.push(personaMsg[a.persona]);
    }
    if (!out.length) out.push("综合五维测评结果，该职位与你较为匹配");
    return out.slice(0, 3);
  }

  function jobById(id) { return JOBS.find(j => j.id === id); }
  function courseById(id) { return COURSES.find(c => c.id === id); }

  const LEVELS = [
    [0, "Lv.1 启航新人"], [150, "Lv.2 探索者"], [400, "Lv.3 进阶者"],
    [750, "Lv.4 行动派"], [1200, "Lv.5 职场达人"],
  ];

  function levelOf(xp) {
    let cur = LEVELS[0], next = null;
    for (let i = 0; i < LEVELS.length; i++) {
      if (xp >= LEVELS[i][0]) cur = LEVELS[i];
      else { next = LEVELS[i]; break; }
    }
    const base = cur[0], span = next ? next[0] - base : 1;
    const pct = next ? Math.min(100, ((xp - base) / span) * 100) : 100;
    return { label: cur[1], pct };
  }

  const AGE_BIAS_RULES = [
    { word: "28岁以下", level: "high", desc: "直接设定年龄上限，属于明显的年龄歧视表述", suggestion: "删除年龄限制，改为「具备相关经验」" },
    { word: "35岁以下", level: "high", desc: "直接设定年龄上限，35+求职者会被自动筛除", suggestion: "删除年龄限制，改为「3年以上相关经验」" },
    { word: "95后", level: "high", desc: "以出生年份筛选候选人，变相排除35+群体", suggestion: "改为「年轻有活力」或直接删除" },
    { word: "00后", level: "high", desc: "以出生年份筛选候选人，变相排除35+群体", suggestion: "改为「学习能力强」或直接删除" },
    { word: "年龄不超过", level: "high", desc: "直接的年龄歧视表述", suggestion: "删除，改为对经验和能力的要求" },
    { word: "限应届", level: "high", desc: "排除了所有非应届求职者，35+群体完全无法投递", suggestion: "改为「欢迎应届及有经验者」" },
    { word: "应届毕业生", level: "medium", desc: "如非校招岗位，此表述会排除有经验的求职者", suggestion: "改为「1-3年经验或优秀应届生」" },
    { word: "统招本科", level: "medium", desc: "隐含筛选年轻群体的意图，35+求职者可能第一学历非统招", suggestion: "改为「本科及以上学历」" },
    { word: "抗压能力强", level: "medium", desc: "常用于暗示需要高强度加班，对需要兼顾家庭的求职者不利", suggestion: "改为「能高效完成工作任务」" },
    { word: "能接受高强度", level: "medium", desc: "直接暗示加班文化，对35+求职者不公平", suggestion: "改为「能在规定时间内高质量交付」" },
    { word: "未婚优先", level: "medium", desc: "婚姻状况歧视，违反劳动法相关规定", suggestion: "删除此表述" },
    { word: "无生育计划", level: "high", desc: "直接涉及生育歧视，违反多项劳动法规", suggestion: "删除此表述，属违法内容" },
  ];

  function detectAgeBias(text) {
    if (!text) return { score: 0, riskLevel: "安全", riskColor: "#2ea56a", issues: [], summary: "未输入内容" };
    const found = [];
    for (const rule of AGE_BIAS_RULES) {
      if (text.includes(rule.word)) found.push({ ...rule });
    }
    let score = 0;
    const weights = { high: 25, medium: 12, low: 5 };
    for (const item of found) score += weights[item.level] || 0;
    score = Math.min(100, score);
    let riskLevel, riskColor;
    if (score === 0) { riskLevel = "安全"; riskColor = "#2ea56a"; }
    else if (score <= 15) { riskLevel = "低风险"; riskColor = "#0284c7"; }
    else if (score <= 40) { riskLevel = "中风险"; riskColor = "#d97706"; }
    else { riskLevel = "高风险"; riskColor = "#dc2626"; }
    let summary;
    if (score === 0) summary = '未检测到年龄歧视风险，该文本表述规范安全。';
    else if (score <= 15) summary = `检测到轻微风险表述（${found.length}处），建议优化措辞以提升 35+ 求职者通过率。`;
    else if (score <= 40) summary = `检测到 ${found.length} 处中等风险表述，强烈建议修改以避免 35+ 求职者被筛除。`;
    else summary = `检测到 ${found.length} 处高风险年龄歧视表述，该文本将严重阻碍 35+ 求职者获得面试机会！`;
    return { score, riskLevel, riskColor, issues: found, summary };
  }

  // 多维度简历诊断（智能版）
  function diagnoseResume(text, targetJob) {
    if (!text || !text.trim()) return null;
    const t = text.trim();
    const lines = t.split(/\n/).filter(l => l.trim());

    // ==================== 智能解析 ====================

    // 1. 提取结构化信息
    const sections = parseResumeSections(t, lines);
    const timeline = extractTimeline(t);
    const contacts = extractContacts(t);
    const skills = extractSkills(t);
    const achievements = extractAchievements(t);
    const weakPhrases = extractWeakPhrases(t);
    const strongPhrases = extractStrongPhrases(t);

    // 2. 计算各维度分数
    const scores = calculateDimensionScores({
      sections, timeline, contacts, skills, achievements,
      weakPhrases, strongPhrases, text: t, lines
    });

    // 3. 生成诊断结果
    const result = {
      totalScore: scores.total,
      level: getLevel(scores.total),
      summary: generateSummary(scores, sections, timeline, achievements),
      strengths: findStrengths(scores, sections, achievements, skills),
      risks: findRisks(scores, sections, timeline, achievements, weakPhrases, contacts, skills),
      match_analysis: analyzeMatch(t, skills, sections),
      optimization_tips: generateTips(scores, sections, achievements, weakPhrases, skills),
      dimensions: buildDimensions(scores),
      deepAnalysis: []  // 兼容旧版
    };

    return result;
  }

  // ==================== 智能解析函数 ====================

  // 解析简历各区块
  function parseResumeSections(text, lines) {
    const sectionPatterns = [
      { name: 'header', regex: /^(自我评价|个人简介|求职意向|个人总结|关于我)/m },
      { name: 'contact', regex: /联系方式|电话|手机|邮箱|Email|微信|地址/m },
      { name: 'education', regex: /教育背景|学历|毕业|学位|本科|大专|硕士|博士|学校|大学|学院/m },
      { name: 'work', regex: /工作经历|工作经验|从业经历|任职|职业经历/m },
      { name: 'skills', regex: /专业技能|技能特长|技术能力|掌握|精通|熟练/m },
      { name: 'projects', regex: /项目经验|项目经历|参与项目/m },
      { name: 'certs', regex: /证书|资质|认证|执照/m },
      { name: 'awards', regex: /荣誉|获奖|奖项|表彰/m }
    ];

    const found = {};
    for (const s of sectionPatterns) {
      found[s.name] = s.regex.test(text);
    }

    // 提取各区块内容
    const workSection = text.match(/工作经历[：:\s]*([\s\S]*?)(?=教育背景|专业技能|项目经验|自我评价|$)/i);
    const workContent = workSection ? workSection[1] : '';

    const eduSection = text.match(/教育背景[：:\s]*([\s\S]*?)(?=工作经历|专业技能|项目经验|自我评价|$)/i);
    const eduContent = eduSection ? eduSection[1] : '';

    return { found, workContent, eduContent };
  }

  // 提取时间线
  function extractTimeline(text) {
    const patterns = [
      /20\d{2}\s*[-–~至到/]\s*(20\d{2}|至今|现在|目前)/g,
      /(\d{4})\s*年\s*[-–~至到/]\s*(\d{4})\s*年/g,
      /(\d{4})\s*年(\d{1,2})\s*月\s*[-–~至到/]\s*(\d{4})\s*年(\d{1,2})\s*月/g
    ];

    const dates = [];
    for (const p of patterns) {
      const matches = [...text.matchAll(p)];
      for (const m of matches) {
        const startYear = parseInt(m[0].match(/20\d{2}/)[0]);
        dates.push(startYear);
      }
    }

    dates.sort((a, b) => a - b);

    // 检测空白期
    const gaps = [];
    for (let i = 1; i < dates.length; i++) {
      if (dates[i] - dates[i-1] > 1) {
        gaps.push({ from: dates[i-1], to: dates[i], years: dates[i] - dates[i-1] });
      }
    }

    // 检测频繁跳槽
    const recentYears = dates.filter(y => y >= 2022);
    const jobHops = recentYears.length > 3;

    return { dates, gaps, jobHops, span: dates.length > 1 ? dates[dates.length-1] - dates[0] : 0 };
  }

  // 提取联系方式
  function extractContacts(text) {
    const hasEmail = /[\w.-]+@[\w.-]+\.\w+/.test(text);
    const hasPhone = /1[3-9]\d{9}/.test(text);
    const hasWechat = /微信|wechat/i.test(text);
    return { hasEmail, hasPhone, hasWechat, complete: hasEmail && hasPhone };
  }

  // 提取技能
  function extractSkills(text) {
    const skillCategories = {
      technical: /编程|开发|Python|Java|JavaScript|SQL|数据分析|机器学习|AI|前端|后端|测试|运维/,
      management: /管理|领导|统筹|带团队|项目管理|团队管理|部门管理/,
      communication: /沟通|协调|谈判|汇报|演讲|培训/,
      creative: /设计|策划|创意|文案|运营|营销|推广/,
      admin: /行政|人事|HR|财务|客服|前台|文秘/,
      industry: /医疗|教育|金融|电商|互联网|制造业|地产|零售|物流|餐饮/
    };

    const found = {};
    let total = 0;
    for (const [cat, regex] of Object.entries(skillCategories)) {
      if (regex.test(text)) {
        found[cat] = true;
        total++;
      }
    }

    // 检测通用技能（减分项）
    const genericSkills = /Office|Word|Excel|PPT|普通话|英语四级|英语六级|计算机二级/;
    const hasGenericOnly = total <= 1 && genericSkills.test(text);

    return { found, total, hasGenericOnly };
  }

  // 提取成果/数据
  function extractAchievements(text) {
    // 量化数据
    const quantifyMatches = text.match(/\d+[%％万元人天次个月年项目个]/g) || [];
    const hasQuantify = quantifyMatches.length > 0;

    // 动作动词
    const actionVerbs = {
      strong: ['主导', '统筹', '推动', '搭建', '从0到1', '突破', '达成', '荣获', '超额', '提前', '零'],
      medium: ['负责', '管理', '领导', '策划', '设计', '开发', '优化', '提升'],
      weak: ['参与', '协助', '配合', '帮忙', '做过', '负责过', '打杂']
    };

    const strongFound = actionVerbs.strong.filter(v => text.includes(v));
    const mediumFound = actionVerbs.medium.filter(v => text.includes(v));
    const weakFound = actionVerbs.weak.filter(v => text.includes(v));

    // 成果句式检测
    const resultPatterns = [
      /将.+从.+提升|优化|降低|缩短|节省/,
      /实现.+从0到1|从无到有|从零开始/,
      /达成.+目标|指标|业绩|销售额/,
      /带领.+团队.+完成|达成|实现/,
      /获得.+奖项|荣誉|认证|好评/
    ];
    const resultCount = resultPatterns.filter(p => p.test(text)).length;

    return {
      quantifyCount: quantifyMatches.length,
      hasQuantify,
      strongVerbs: strongFound,
      mediumVerbs: mediumFound,
      weakVerbs: weakFound,
      resultCount,
      quality: quantifyMatches.length >= 5 && strongFound.length >= 3 ? 'high'
             : quantifyMatches.length >= 2 && (strongFound.length + mediumFound.length) >= 2 ? 'medium'
             : 'low'
    };
  }

  // 提取弱化表述
  function extractWeakPhrases(text) {
    const patterns = [
      { regex: /负责过|做过|参与了|帮忙|打杂|还行|还可以|一般|普通|基本|协助|配合/g, type: '弱动词' },
      { regex: /熟练使用Office|精通Word|熟悉Excel/g, type: '通用技能' },
      { regex: /性格开朗|工作认真|团队精神|吃苦耐劳|学习能力强/g, type: '套话' },
      { regex: /提高了效率|优化了流程|完成了任务/g, type: '无数据成果' }
    ];

    const found = [];
    for (const p of patterns) {
      const matches = text.match(p.regex) || [];
      for (const m of matches) {
        found.push({ phrase: m, type: p.type });
      }
    }
    return found;
  }

  // 提取强表述
  function extractStrongPhrases(text) {
    const patterns = [
      { regex: /从0到1|从无到有|从零开始/g, type: '开创性' },
      { regex: /主导|统筹|推动|搭建|突破|达成|荣获|超额|提前|零/g, type: '强动词' },
      { regex: /提升\d+%|节省\d+万|增长\d+%|优化\d+%/g, type: '量化成果' },
      { regex: /带领\d+人团队|管理\d+人|负责\d+万/g, type: '规模感' }
    ];

    const found = [];
    for (const p of patterns) {
      const matches = text.match(p.regex) || [];
      for (const m of matches) {
        found.push({ phrase: m, type: p.type });
      }
    }
    return found;
  }

  // ==================== 评分系统 ====================

  function calculateDimensionScores(data) {
    const { sections, timeline, contacts, skills, achievements, weakPhrases, strongPhrases, text, lines } = data;

    // 1. 结构完整性 (0-100)
    const structScore = Math.min(100,
      (sections.found.header ? 20 : 0) +
      (sections.found.contact ? 15 : 0) +
      (sections.found.work ? 30 : 0) +
      (sections.found.education ? 15 : 0) +
      (sections.found.skills ? 15 : 0) +
      (sections.found.projects ? 5 : 0)
    );

    // 2. 数据说服力 (0-100)
    const quantScore = Math.min(100,
      achievements.quantifyCount >= 8 ? 95 :
      achievements.quantifyCount >= 5 ? 80 :
      achievements.quantifyCount >= 3 ? 60 :
      achievements.quantifyCount >= 1 ? 35 : 10
    );

    // 3. 表述力度 (0-100)
    const verbScore = Math.min(100, Math.max(10,
      50 + achievements.strongVerbs.length * 12
      - achievements.weakVerbs.length * 15
      + (achievements.resultCount * 5)
    ));

    // 4. 职业路径 (0-100)
    let pathScore = 70;  // 基础分
    if (timeline.gaps.length > 0) {
      const hasExplanation = /学习|进修|考证|培训|照顾|育儿|自由职业|创业|兼职|全职妈妈|家庭|自由/.test(text);
      pathScore -= timeline.gaps.length * 10;
      if (hasExplanation) pathScore += 5;  // 有解释稍微加回
    }
    if (timeline.jobHops) pathScore -= 15;
    if (timeline.dates.length >= 3 && !timeline.jobHops) pathScore += 10;
    pathScore = Math.max(0, Math.min(100, pathScore));

    // 5. 关键词覆盖 (0-100)
    const keywordCategories = {
      management: /管理|领导|统筹|带团队/,
      execution: /执行|落地|实施|推进/,
      results: /提升|增长|节省|优化|达成|突破/,
      skills: /技能|能力|掌握|熟悉|精通/,
      communication: /沟通|协调|汇报|协作/,
      problem: /问题|解决|分析|优化|改进/,
      industry: /行业|领域|市场|客户|用户/,
      data: /数据|分析|报表|指标|KPI/
    };
    let kwHit = 0;
    for (const [, regex] of Object.entries(keywordCategories)) {
      if (regex.test(text)) kwHit++;
    }
    const kwScore = Math.min(100, kwHit * 14);

    // 6. 信息密度 (0-100)
    const charCount = text.replace(/\s/g, '').length;
    const densityScore = Math.min(100,
      charCount < 100 ? 15 :
      charCount < 300 ? 35 :
      charCount < 500 ? 55 :
      charCount < 800 ? 75 :
      charCount < 1500 ? 85 :
      charCount < 2500 ? 70 : 50
    );

    // 7. 年龄风险 (0-100，越高越安全)
    const ageBias = detectAgeBias(text);
    const ageScore = Math.max(0, 100 - ageBias.score);

    // 8. 联系方式 (0-100)
    const contactScore = contacts.complete ? 95 : (contacts.hasEmail || contacts.hasPhone) ? 60 : 20;

    // 加权总分
    const weights = {
      struct: 12, quant: 20, verb: 18, path: 15,
      kw: 12, density: 8, age: 10, contact: 5
    };
    const total = Math.round(
      structScore * weights.struct / 100 +
      quantScore * weights.quant / 100 +
      verbScore * weights.verb / 100 +
      pathScore * weights.path / 100 +
      kwScore * weights.kw / 100 +
      densityScore * weights.density / 100 +
      ageScore * weights.age / 100 +
      contactScore * weights.contact / 100
    );

    return {
      total,
      struct: structScore,
      quant: quantScore,
      verb: verbScore,
      path: pathScore,
      kw: kwScore,
      density: densityScore,
      age: ageScore,
      contact: contactScore
    };
  }

  function getLevel(score) {
    if (score >= 90) return '优秀';
    if (score >= 75) return '良好';
    if (score >= 60) return '一般';
    if (score >= 40) return '较差';
    return '很差';
  }

  function generateSummary(scores, sections, timeline, achievements) {
    const parts = [];
    if (scores.total >= 80) parts.push('简历整体质量较高');
    else if (scores.total >= 60) parts.push('简历有基础框架');
    else parts.push('简历存在明显问题');

    if (scores.quant < 40) parts.push('数据说服力不足');
    if (scores.verb < 40) parts.push('表述力度偏弱');
    if (scores.path < 50) parts.push('职业路径有待梳理');
    if (scores.kw < 50) parts.push('关键词覆盖不够');
    if (scores.age < 60) parts.push('存在年龄歧视风险');

    return parts.join('，') + '。';
  }

  // ==================== 诊断分析 ====================

  function findStrengths(scores, sections, achievements, skills) {
    const strengths = [];

    if (achievements.quantifyCount >= 5) strengths.push('包含 ' + achievements.quantifyCount + ' 处量化数据，数据说服力较强');
    if (achievements.strongVerbs.length >= 3) strengths.push('使用了「' + achievements.strongVerbs.slice(0,3).join('、') + '」等强动词，表述有力');
    if (scores.struct >= 80) strengths.push('简历结构完整，各模块齐全');
    if (scores.kw >= 70) strengths.push('关键词覆盖较广，ATS通过率高');
    if (scores.age >= 80) strengths.push('未发现年龄歧视风险表述');
    if (skills.total >= 4) strengths.push('技能覆盖面广，具备复合能力');
    if (achievements.resultCount >= 3) strengths.push('有多处成果描述，体现价值输出');
    if (scores.density >= 70 && scores.density <= 85) strengths.push('篇幅适中，信息密度合理');

    if (strengths.length === 0) strengths.push('简历有基本框架，具备改进基础');

    return strengths.slice(0, 5);
  }

  function findRisks(scores, sections, timeline, achievements, weakPhrases, contacts, skills) {
    const risks = [];

    // 年龄风险
    if (scores.age < 70) {
      risks.push({
        type: '年龄歧视风险',
        severity: scores.age < 40 ? '高危' : '中危',
        detail: '简历中存在可能触发ATS系统或HR自动筛除的年龄相关表述',
        consequence: '简历在系统层面被过滤，HR根本看不到',
        suggestion: '删除毕业年份、年龄相关词汇，突出经验和成果而非资历'
      });
    }

    // 弱化动词
    const weakVerbs = weakPhrases.filter(p => p.type === '弱动词');
    if (weakVerbs.length > 0) {
      risks.push({
        type: '表述力度',
        severity: weakVerbs.length > 3 ? '高危' : '中危',
        detail: '使用了 ' + weakVerbs.length + ' 处弱化动词（如「' + weakVerbs.slice(0,3).map(w=>w.phrase).join('、') + '」），HR判断你可能是执行者而非决策者',
        consequence: '降低HR对你能力的预期，面试邀约率下降',
        suggestion: '将「负责/参与/协助」替换为「主导/统筹/推动/搭建/优化」'
      });
    }

    // 数据不足
    if (achievements.quantifyCount < 3) {
      risks.push({
        type: '数据说服力',
        severity: achievements.quantifyCount === 0 ? '高危' : '中危',
        detail: achievements.quantifyCount === 0
          ? '整篇简历无任何量化数据，HR无法判断你的实际能力水平'
          : '仅 ' + achievements.quantifyCount + ' 处量化数据，信息量不足',
        consequence: '没有数据支撑的工作经历在HR眼里约等于「没做过」',
        suggestion: '回顾每段工作：管了多少人？花了多少钱？产出了多少？把数字写出来'
      });
    }

    // 模糊成果
    if (achievements.resultCount < 2 && achievements.quantifyCount > 0) {
      risks.push({
        type: '成果说服力',
        severity: '中危',
        detail: '虽然有量化数据，但缺乏「从A到B」的成果对比描述',
        consequence: '数据显得零散，缺乏故事性和说服力',
        suggestion: '用「从...提升/优化到...」句式，让数据有对比感和成长感'
      });
    }

    // 职业路径
    if (timeline.gaps.length > 0) {
      const hasExplanation = /学习|进修|考证|培训|照顾|育儿|自由职业|创业|兼职|全职妈妈|家庭|自由/.test(text);
      if (!hasExplanation) {
        risks.push({
          type: '职业路径',
          severity: '中危',
          detail: '存在 ' + timeline.gaps.length + ' 段职业空白期（如 ' + timeline.gaps[0].from + '-' + timeline.gaps[0].to + ' 年），且无合理解释',
          consequence: 'HR会怀疑：是否被裁？能力不行找不到工作？',
          suggestion: '正面解释空白期，如「期间全职照顾家人，同时完成了PMP认证和Python课程」'
        });
      }
    }

    if (timeline.jobHops) {
      risks.push({
        type: '职业稳定性',
        severity: '中危',
        detail: '近3年工作变动频繁，HR可能质疑你的稳定性',
        consequence: '雇主担心你入职后很快离职，招聘成本打水漂',
        suggestion: '在简历中说明每次变动的合理性（如公司倒闭、业务调整、职业升级）'
      });
    }

    // 联系方式
    if (!contacts.complete) {
      risks.push({
        type: '基础信息',
        severity: contacts.hasEmail || contacts.hasPhone ? '低危' : '高危',
        detail: contacts.hasEmail && !contacts.hasPhone ? '缺少手机号码' : contacts.hasPhone && !contacts.hasEmail ? '缺少邮箱' : '联系方式严重不完整',
        consequence: 'HR无法联系到你，简历等于白投',
        suggestion: '确保至少有手机号和邮箱，并保持畅通'
      });
    }

    // 技能
    if (skills.hasGenericOnly) {
      risks.push({
        type: '技能匹配',
        severity: '低危',
        detail: '技能模块主要列的是Office/英语等通用技能，这些是35+求职者标配，不是加分项',
        consequence: '无法体现不可替代性，和年轻候选人没有差异化',
        suggestion: '突出行业Know-how、特定系统经验、管理能力等35+专属优势'
      });
    }

    // 套话
    const genericPhrases = weakPhrases.filter(p => p.type === '套话');
    if (genericPhrases.length > 0) {
      risks.push({
        type: '自我评价',
        severity: '低危',
        detail: '自我评价使用了「' + genericPhrases.slice(0,3).map(p=>p.phrase).join('、') + '」等套话，90%简历都在用',
        consequence: 'HR看了等于没看，错过展示核心竞争力的机会',
        suggestion: '用一句话概括最大竞争力，如「10年供应链管理经验，主导3次系统迁移，累计节省200万+」'
      });
    }

    // 按严重程度排序
    const severityOrder = { '高危': 0, '中危': 1, '低危': 2 };
    risks.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return risks.slice(0, 8);
  }

  function analyzeMatch(text, skills, sections) {
    // 从简历推断可能的目标岗位类型
    const jobHints = {
      '管理': /管理|领导|统筹|带团队|部门/,
      '技术': /开发|编程|Python|Java|SQL|测试|运维/,
      '运营': /运营|推广|营销|活动|内容/,
      '行政人事': /行政|人事|HR|招聘|薪酬/,
      '财务': /财务|会计|审计|出纳|报表/,
      '销售': /销售|客户|业绩|签单|回款/,
      '设计': /设计|UI|UX|视觉|美工/,
      '教育': /教学|培训|课程|学生|教务/,
      '医疗': /医疗|护理|临床|医院|患者/
    };

    const matched = [];
    for (const [job, regex] of Object.entries(jobHints)) {
      if (regex.test(text)) matched.push(job);
    }

    const primaryJob = matched.length > 0 ? matched[0] : '未明确';

    let matchLevel = '中';
    let gapDescription = '';

    if (skills.total >= 4 && skills.found.management) {
      matchLevel = '高';
      gapDescription = '简历展现了较强的综合能力，技能覆盖面广，管理经验突出。';
    } else if (skills.total <= 2 || !skills.found.management) {
      matchLevel = '低';
      gapDescription = '简历的技能展示较为单一，管理能力和综合能力体现不足。';
    } else {
      gapDescription = '简历具备一定竞争力，但在某些维度有优化空间。';
    }

    const missing = [];
    if (!skills.found.management) missing.push('管理能力');
    if (!skills.found.communication) missing.push('沟通协调');
    if (!skills.found.results) missing.push('成果量化');
    if (!skills.found.data) missing.push('数据分析');

    return {
      target_position: matched.length > 0 ? '可能适合' + matched.join('、') + '类岗位' : '未明确（简历未指定求职目标）',
      match_level: matchLevel,
      gap_description: gapDescription,
      key_missing_skills: missing
    };
  }

  function generateTips(scores, sections, achievements, weakPhrases, skills) {
    const tips = [];

    if (achievements.quantifyCount < 5) tips.push('给每段工作经历补充1-2个量化成果（人数、金额、百分比、时间缩短等）');
    if (achievements.weakVerbs.length > 0) tips.push('将弱化动词替换为高强度动词：主导/统筹/推动/搭建/优化/达成/突破');
    if (scores.kw < 70) tips.push('在工作经历描述中自然融入更多行业关键词，提升ATS通过率');
    if (achievements.resultCount < 2) tips.push('用「从...提升/优化到...」句式描述成果，增加对比感和说服力');
    if (scores.age < 70) tips.push('删除或替换可能触发年龄歧视的表述（如毕业年份、年龄相关词汇）');
    if (skills.hasGenericOnly) tips.push('技能模块突出35+专属优势：行业经验、管理能力、特定系统等');
    if (weakPhrases.filter(p => p.type === '套话').length > 0) tips.push('重写自我评价，用一句话概括核心竞争力，避免套话');
    if (!sections.found.projects) tips.push('如有项目经验，单独列出「项目经历」模块，突出个人贡献');
    if (scores.density < 50) tips.push('简历内容过少，建议补充工作细节、项目经历、技能描述等');

    return tips.slice(0, 6);
  }

  function buildDimensions(scores) {
    return [
      { name: '结构完整性', icon: 'ri-file-list-3-line', score: scores.struct, weight: 12, detail: '模块完整度', color: scores.struct >= 70 ? '#2ea56a' : scores.struct >= 40 ? '#d97706' : '#dc2626' },
      { name: '数据说服力', icon: 'ri-bar-chart-grouped-line', score: scores.quant, weight: 20, detail: '量化数据密度', color: scores.quant >= 70 ? '#2ea56a' : scores.quant >= 40 ? '#d97706' : '#dc2626' },
      { name: '表述力度', icon: 'ri-quill-pen-line', score: scores.verb, weight: 18, detail: '动词强度', color: scores.verb >= 70 ? '#2ea56a' : scores.verb >= 40 ? '#d97706' : '#dc2626' },
      { name: '职业路径', icon: 'ri-route-line', score: scores.path, weight: 15, detail: '连贯性与稳定性', color: scores.path >= 70 ? '#2ea56a' : scores.path >= 40 ? '#d97706' : '#dc2626' },
      { name: '关键词覆盖', icon: 'ri-key-2-line', score: scores.kw, weight: 12, detail: 'ATS通过率', color: scores.kw >= 70 ? '#2ea56a' : scores.kw >= 40 ? '#d97706' : '#dc2626' },
      { name: '信息密度', icon: 'ri-article-line', score: scores.density, weight: 8, detail: '篇幅合理性', color: scores.density >= 70 ? '#2ea56a' : scores.density >= 40 ? '#d97706' : '#dc2626' },
      { name: '年龄风险', icon: 'ri-shield-check-line', score: scores.age, weight: 10, detail: scores.age >= 70 ? '安全' : '有风险', color: scores.age >= 70 ? '#2ea56a' : scores.age >= 40 ? '#d97706' : '#dc2626' },
      { name: '联系方式', icon: 'ri-phone-line', score: scores.contact, weight: 5, detail: scores.contact >= 80 ? '完整' : '不完整', color: scores.contact >= 80 ? '#2ea56a' : '#d97706' }
    ];
  }

  // ==================== 测评深度分析引擎 ====================
  function generateAssessmentAnalysis(a, report) {
    const sections = [];

    // ── 1. 你是谁 ──
    const personaLabel = a.persona === 'mom' ? '全职妈妈' : '35+ 职场人';
    const personaDesc = a.persona === 'mom'
      ? '你正处于重返职场的关键阶段。全职照顾家庭的经历并不是「空白期」，而是一段积累了耐心、时间管理、多任务处理能力的成长期。关键是把这些能力翻译成职场语言。'
      : '你是一位有丰富职场经验的 35+ 求职者。多年的积累是你最大的资产——行业认知、人脉资源、处理复杂问题的能力，这些都是年轻候选人无法快速获得的。';
    sections.push({
      title: '你的画像',
      icon: 'ri-user-star-line',
      paragraphs: [
        `作为「${personaLabel}」，${personaDesc}`,
        `这个定位决定了你的求职策略：不要和 25 岁的人比「精力旺盛」，而要和他们比「经验深度」和「解决问题的能力」。`
      ]
    });

    // ── 2. 兴趣驱动力 ──
    if (a.interests.length > 0) {
      const interestLabels = a.interests.map(id => INTERESTS.find(x => x.id === id)?.label).filter(Boolean);
      const topJobInterests = report.top[0].job.fit.interests;
      const alignedInterests = a.interests.filter(id => (topJobInterests[id] || 0) >= 0.6);
      const alignedLabels = alignedInterests.map(id => INTERESTS.find(x => x.id === id)?.label).filter(Boolean);

      const interestSection = {
        title: '兴趣驱动力',
        icon: 'ri-compass-3-line',
        paragraphs: [
          `你选择了 ${interestLabels.length} 个兴趣方向：${interestLabels.join('、')}。兴趣不是「喜欢什么」这么简单——它决定了你在什么领域能自发投入、持续深耕而不觉得累。`
        ]
      };
      if (alignedLabels.length > 0) {
        interestSection.paragraphs.push(
          `好消息是，你最匹配的岗位「${report.top[0].job.name}」正好需要这些兴趣：${alignedLabels.join('、')}。这意味着你在做这份工作时，会更容易进入「心流」状态，不容易职业倦怠。`
        );
      } else {
        interestSection.paragraphs.push(
          `不过，你选择的兴趣方向和最匹配的岗位之间有一定错位。这不一定坏事——说明你有跨领域的潜力，但也意味着入行初期需要更多适应。`
        );
      }
      sections.push(interestSection);
    }

    // ── 3. 技能盘点 ──
    if (a.skills.length > 0) {
      const skillLabels = a.skills.map(id => SKILL_LABELS[id]).filter(Boolean);
      const jobSkills = report.top[0].job.fit.skills;
      const strongSkills = a.skills.filter(id => (jobSkills[id] || 0) >= 0.7).map(id => SKILL_LABELS[id]).filter(Boolean);
      const weakSkills = Object.entries(jobSkills).filter(([id, w]) => w >= 0.5 && !a.skills.includes(id)).map(([id]) => SKILL_LABELS[id]).filter(Boolean);

      const skillSection = {
        title: '技能盘点',
        icon: 'ri-tools-line',
        paragraphs: [
          `你目前掌握的技能：${skillLabels.join('、')}。`
        ]
      };
      if (strongSkills.length > 0) {
        skillSection.paragraphs.push(
          `其中 ${strongSkills.join('、')} 和目标岗位「${report.top[0].job.name}」的需求高度吻合，这是你的核心竞争力。在简历和面试中，要重点展示这些技能的实际应用案例。`
        );
      }
      if (weakSkills.length > 0) {
        skillSection.paragraphs.push(
          `但这个岗位还需要你目前不具备的技能：${weakSkills.slice(0, 3).join('、')}。这不代表你不能做这份工作——35+ 求职者学新技能的速度和深度远超应届生，因为你有大量可迁移的经验。建议在简历中体现你的学习能力，或提前自学补上。`
        );
      }
      sections.push(skillSection);
    }

    // ── 4. 性格特质 ──
    const traitAnalysis = [];
    const sortedTraits = TRAITS.map(t => ({ ...t, score: a.traits[t.id] || 0 })).sort((a, b) => b.score - a.score);
    const topTraits = sortedTraits.slice(0, 2);
    const weakTraits = sortedTraits.slice(-2);

    const jobTraitReqs = {};
    for (const t of TRAITS) {
      jobTraitReqs[t.id] = report.top[0].job.fit.traits[t.id] || 0.5;
    }
    const sortedJobTraits = TRAITS.map(t => ({ id: t.id, label: t.label, req: jobTraitReqs[t.id] })).sort((a, b) => b.req - a.req);
    const topJobTraits = sortedJobTraits.slice(0, 2);

    const traitSection = {
      title: '性格特质',
      icon: 'ri-brain-line',
      paragraphs: [
        `你的六维能力画像中，最突出的两个维度是「${topTraits[0].label}」（${topTraits[0].score}/10）和「${topTraits[1].label}」（${topTraits[1].score}/10）。这说明你是一个 ${topTraits[0].score >= 7 ? '在' + topTraits[0].label + '方面有明显优势的人' : topTraits[0].label + '基础不错的人'}。`
      ]
    };

    const matchTrait = topTraits[0].label === topJobTraits[0].label || topTraits[0].label === topJobTraits[1].label;
    if (matchTrait) {
      traitSection.paragraphs.push(
        `而「${report.top[0].job.name}」最看重的恰恰是「${topJobTraits[0].label}」——和你的优势高度吻合。这是你面试时最值得强调的卖点。`
      );
    } else {
      traitSection.paragraphs.push(
        `「${report.top[0].job.name}」最看重的是「${topJobTraits[0].label}」和「${topJobTraits[1].label}」，这和你的核心优势有一定错位。好消息是，性格特质不是固定不变的——你可以在工作中有意识地锻炼这些维度。`
      );
    }

    if (weakTraits[0].score <= 5) {
      traitSection.paragraphs.push(
        `你的「${weakTraits[0].label}」维度偏弱（${weakTraits[0].score}/10）。如果目标岗位需要这个能力，建议在简历中用具体案例证明，比如：虽然不是强项，但在 XX 项目中成功运用了。`
      );
    }
    sections.push(traitSection);

    // ── 5. 工作偏好 ──
    if (a.prefs.length > 0) {
      const prefLabels = a.prefs.map(id => PREF_ITEMS.find(x => x.id === id)?.label).filter(Boolean);
      const jobPrefs = report.top[0].job.fit.prefs;
      const matchedPrefs = a.prefs.filter(id => (jobPrefs[id] || 0) >= 0.6).map(id => PREF_ITEMS.find(x => x.id === id)?.label).filter(Boolean);
      const conflictPrefs = a.prefs.filter(id => (jobPrefs[id] || 0) < 0.3).map(id => PREF_ITEMS.find(x => x.id === id)?.label).filter(Boolean);

      const prefSection = {
        title: '工作偏好',
        icon: 'ri-heart-pulse-line',
        paragraphs: [
          `你期望的工作状态：${prefLabels.join('、')}。`
        ]
      };
      if (matchedPrefs.length > 0) {
        prefSection.paragraphs.push(
          `其中「${matchedPrefs.join('、')}」在目标岗位中可以得到满足。这很重要——工作内容匹配只能决定你「能不能做」，而工作偏好匹配决定你「做得开不开心」。`
        );
      }
      if (conflictPrefs.length > 0) {
        prefSection.paragraphs.push(
          `但要注意：你期望的「${conflictPrefs.join('、')}」在目标岗位中可能无法完全满足。这不是说不能选这个岗位，而是你需要想清楚：这些偏好是你「必须有的底线」还是「最好有但可以妥协」的？如果是底线，可以考虑备选岗位。`
        );
      }
      sections.push(prefSection);
    }

    // ── 6. 总结 ──
    const top1 = report.top[0];
    const top2 = report.top[1];
    const top3 = report.top[2];
    sections.push({
      title: '综合建议',
      icon: 'ri-lightbulb-flash-line',
      paragraphs: [
        `综合你的兴趣、技能、性格和偏好，你最匹配的方向是「${top1.job.name}」（匹配度 ${top1.total}%）。${top1.job.desc}`,
        top2 ? `备选方向是「${top2.job.name}」（${top2.total}%）和「${top3.job.name}」（${top3.total}%）。如果你对第一选择不确定，可以同时关注这两个方向。` : '',
        `接下来你可以：① 针对目标岗位优化简历（突出匹配的技能和经历）；② 查看「岗位详情」了解具体要求；③ 使用「AI 简历诊断」检查简历质量。`
      ].filter(Boolean)
    });

    return sections;
  }

  return {
    scoreJob, buildReport, gapSkills, gapCoursePlan, reasonText, jobById, courseById, levelOf, detectAgeBias, diagnoseResume, generateAssessmentAnalysis
  };
}));
