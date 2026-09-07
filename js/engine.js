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

  // 多维度简历诊断
  function diagnoseResume(text, targetJob) {
    if (!text || !text.trim()) return null;
    const t = text.trim();
    const lines = t.split(/\n/).filter(l => l.trim());
    const result = {
      totalScore: 0,
      dimensions: [],
      deepAnalysis: [],
      summary: ''
    };

    // ==================== 深度剖析引擎 ====================

    // 1. 简历长度与信息密度
    const charCount = t.replace(/\s/g, '').length;
    const lineCount = lines.length;
    const avgLineLen = charCount / Math.max(1, lineCount);

    // 2. 找出所有弱化表述及其所在行
    const weakWords = ['负责过','做过','参与了','帮忙','打杂','还行','还可以','一般','普通','基本','协助','配合'];
    const weakFound = [];
    for (const w of weakWords) {
      const idx = t.indexOf(w);
      if (idx !== -1) {
        // 取该词前后各20字作为上下文
        const start = Math.max(0, idx - 20);
        const end = Math.min(t.length, idx + w.length + 20);
        const context = t.substring(start, end).replace(/\n/g, ' ').trim();
        weakFound.push({ word: w, context: context });
      }
    }

    // 3. 找出量化数据
    const quantified = t.match(/\d+[%％万元人天次个月年项目个]/g) || [];
    const quantifyDetails = [];
    for (const q of quantified) {
      const idx = t.indexOf(q);
      const start = Math.max(0, idx - 30);
      const end = Math.min(t.length, idx + q.length + 10);
      quantifyDetails.push(t.substring(start, end).replace(/\n/g, ' ').trim());
    }

    // 4. 找出工作经历条目（按时间或动词开头的行）
    const workLines = lines.filter(l => /负责|担任|主导|参与|完成|管理|带领|协调|策划|执行/.test(l));
    const vagueWorkLines = workLines.filter(l => !/\d+/.test(l) && !/提升|增长|节省|优化|突破/.test(l));

    // 5. 找出技能描述
    const skillLines = lines.filter(l => /精通|熟练|掌握|熟悉|了解|擅长|技能|能力/.test(l));

    // 6. 找出自我评价
    const selfEval = lines.filter(l => /自我评价|个人简介|自我介绍|关于我/.test(l));
    const selfContent = selfEval.length ? lines.slice(lines.indexOf(selfEval[0])).join(' ').substring(0, 200) : '';

    // 7. 时间线分析
    const yearPattern = /20\d{2}\s*[-–~至到/]\s*(20\d{2}|至今|现在|目前)/g;
    const timeMatches = [...t.matchAll(yearPattern)];
    const years = timeMatches.map(m => {
      const startYear = parseInt(m[0].match(/20\d{2}/)[0]);
      return startYear;
    }).sort((a, b) => a - b);

    // 8. 专业动词统计
    const strongVerbs = ['主导','统筹','推动','优化','提升','突破','达成','荣获','领导','管理','策划','设计','开发','搭建','从0到1','负责'];
    const strongFound = strongVerbs.filter(v => t.includes(v));

    // 9. 关键词
    const skillKeywords = ['管理','领导','协调','沟通','策划','执行','分析','设计','开发','运营','营销','销售','财务','行政','人事','客服','项目','产品','数据','市场'];
    const hitKeywords = skillKeywords.filter(k => t.includes(k));

    // 10. 年龄歧视
    const ageBias = detectAgeBias(t);

    // ==================== 生成深度剖析文本 ====================
    result.deepAnalysis = [];

    // 开篇总览
    const wordCountApprox = Math.round(charCount / 2);
    result.deepAnalysis.push({
      title: '简历概览',
      icon: 'ri-file-text-line',
      paragraphs: [
        `这份简历共 ${lineCount} 行，约 ${wordCountApprox} 字。${charCount < 300 ? '内容偏少，HR获取的信息量不足以做出面试判断。' : charCount > 2000 ? '篇幅较长，建议精简到1页以内，HR平均只花6-8秒扫一份简历。' : '篇幅适中。'}`,
        `${workLines.length ? `找到 ${workLines.length} 条与工作经历相关的表述` : '未发现明确的工作经历描述'}。${skillLines.length ? `${skillLines.length} 处技能相关表述。` : ''}${timeMatches.length ? `时间线跨度从 ${years[0]} 年到 ${years[years.length-1]} 年。` : ''}`
      ]
    });

    // 逐句剖析弱化表述
    if (weakFound.length > 0) {
      const weakAnalysis = {
        title: '动词力度分析',
        icon: 'ri-quill-pen-line',
        paragraphs: []
      };
      weakAnalysis.paragraphs.push(`你在简历中使用了 ${weakFound.length} 处偏弱的动词表述。这些词会让HR觉得你只是「做了这件事」，而不是「做出了成绩」。`);
      weakFound.slice(0, 4).forEach(item => {
        weakAnalysis.paragraphs.push(`• 你写的是「${item.context}」——这里的「${item.word}」是典型的被动表述。建议改成：主导/统筹/推动/优化，让HR看到你是这件事的主人，而不是旁观者。`);
      });
      if (strongFound.length) {
        weakAnalysis.paragraphs.push(`不过你也用了一些不错的动词，比如「${strongFound.slice(0,3).join('、')}」，只是不够统一。建议全文统一使用强有力动词。`);
      }
      result.deepAnalysis.push(weakAnalysis);
    } else if (strongFound.length) {
      result.deepAnalysis.push({
        title: '动词力度分析',
        icon: 'ri-quill-pen-line',
        paragraphs: [
          `你使用了 ${strongFound.length} 个专业行动动词：「${strongFound.slice(0,5).join('、')}」，动词选择整体不错，能有效传达你的主动性和执行力。`
        ]
      });
    }

    // 量化成果深度分析
    const quantAnalysis = {
      title: '数据说服力分析',
      icon: 'ri-bar-chart-grouped-line',
      paragraphs: []
    };
    if (quantified.length >= 5) {
      quantAnalysis.paragraphs.push(`你的简历包含 ${quantified.length} 处量化数据，这在35+求职者中属于较好水平。`);
      quantifyDetails.slice(0, 3).forEach(d => {
        quantAnalysis.paragraphs.push(`• 比如「${d}」——这类数据能让HR直观看到你的成果，比单纯说「负责XX工作」有说服力得多。`);
      });
    } else if (quantified.length > 0) {
      quantAnalysis.paragraphs.push(`你的简历中仅发现 ${quantified.length} 处量化数据。有数据比没有好，但数量偏少。`);
      quantifyDetails.forEach(d => {
        quantAnalysis.paragraphs.push(`• 你提到「${d}」，这是好的开头。`);
      });
      quantAnalysis.paragraphs.push(`• 建议：每段工作经历至少补充1-2个数据。比如「管理XX人团队」「提升XX%效率」「节省XX万成本」「完成XX个项目」。没有数据支撑的工作经历，说服力会大打折扣。`);
    } else {
      quantAnalysis.paragraphs.push(`你的简历中没有找到任何量化数据（数字+单位的组合）。这是35+求职简历中最常见的问题。`);
      quantAnalysis.paragraphs.push(`• HR看到「负责项目管理」会想：管理了几个？多大规模？什么行业？没数据就等于没说。`);
      quantAnalysis.paragraphs.push(`• 建议：回顾你过去的工作，至少补充3-5个数据点。哪怕是估算的也比没有强。比如「带领5人小组」「项目预算50万」「服务200+客户」。`);
    }
    result.deepAnalysis.push(quantAnalysis);

    // 工作经历质量
    if (vagueWorkLines.length > 0) {
      result.deepAnalysis.push({
        title: '工作经历质量',
        icon: 'ri-briefcase-line',
        paragraphs: [
          `你有 ${vagueWorkLines.length} 条工作经历描述缺乏数据支撑，只描述了「做了什么」而没有说「做出了什么结果」。`,
          `• 你写「${vagueWorkLines[0].trim().substring(0, 60)}${vagueWorkLines[0].trim().length > 60 ? '...' : ''}」——这句话告诉HR你做了这件事，但没告诉他你做得怎么样。`,
          `• 好的工作经历描述公式：动作动词 + 具体事项 + 量化结果。例如：「主导XX项目重构，将处理时间从3天缩短到4小时，效率提升83%」。`
        ]
      });
    }

    // 空窗期
    if (years.length >= 2) {
      const gaps = [];
      for (let i = 1; i < years.length; i++) {
        const diff = years[i] - years[i-1];
        if (diff > 1) gaps.push({ from: years[i-1], to: years[i], months: diff * 12 });
      }
      if (gaps.length > 0) {
        const gapAnalysis = { title: '时间线连续性', icon: 'ri-calendar-timeline-line', paragraphs: [] };
        gaps.forEach(g => {
          const gapLine = `• 从 ${g.from} 年到 ${g.to} 年之间有约 ${g.months} 个月的空白。`;
          if (/学习|进修|考证|培训|照顾|育儿|自由职业|创业|兼职/.test(t)) {
            gapAnalysis.paragraphs.push(gapLine + '好在你的简历中提到了这段期间的活动（学习/照顾/创业等），这让空白期变得合理。');
          } else {
            gapAnalysis.paragraphs.push(gapLine + '这段空白没有解释，HR会好奇你这段时间在做什么。建议正面说明：照顾家人、自主学习、自由职业等，把「空白」变成「成长」。');
          }
        });
        result.deepAnalysis.push(gapAnalysis);
      }
    }

    // 关键词覆盖
    if (hitKeywords.length < 8) {
      const missingKw = skillKeywords.filter(k => !t.includes(k)).slice(0, 6);
      result.deepAnalysis.push({
        title: 'ATS关键词匹配',
        icon: 'ri-key-2-line',
        paragraphs: [
          `你的简历匹配了 ${hitKeywords.length} 个核心能力关键词。越来越多企业使用ATS（简历筛选系统）自动过滤，关键词不足会在系统层面就被淘汰。`,
          `• 缺失的关键词：${missingKw.join('、')}。建议在工作经历或技能模块中自然融入这些词。`
        ]
      });
    }

    // 年龄歧视
    if (ageBias.issues.length > 0) {
      result.deepAnalysis.push({
        title: '年龄歧视风险',
        icon: 'ri-shield-check-line',
        paragraphs: [
          `你的简历中检测到 ${ageBias.issues.length} 处可能触发筛除的表述：`,
          ...ageBias.issues.map(i => `• 「${i.word}」——${i.desc}。建议修改为：${i.suggestion}`)
        ]
      });
    }

    // 自我评价
    if (selfContent) {
      const selfVerbs = selfContent.match(/热爱|喜欢|积极|乐观|认真|负责|团队|学习/g) || [];
      if (selfVerbs.length >= 3) {
        result.deepAnalysis.push({
          title: '自我评价分析',
          icon: 'ri-user-heart-line',
          paragraphs: [
            `你的自我评价使用了「${selfVerbs.slice(0,3).join('、')}」等通用词汇。这类表述在90%的简历中都会出现，缺乏辨识度。`,
            `• 建议：用具体事例替代空泛形容词。比如不说「我学习能力强」，而说「2周内自学Python并完成数据分析项目」。`
          ]
        });
      }
    }

    // ==================== 六维度评分 ====================
    // 1. 年龄歧视
    result.dimensions.push({
      name: '年龄歧视风险',
      icon: 'ri-shield-check-line',
      score: Math.max(0, 100 - ageBias.score),
      weight: 20,
      detail: ageBias.issues.length ? `${ageBias.issues.length} 处风险` : '安全',
      color: ageBias.riskColor
    });

    // 2. 结构
    const hasContact = /[\w.-]+@[\w.-]+|1[3-9]\d{9}|微信|手机|电话|联系方式/.test(t);
    const hasWork = /工作经历|工作经验|从业经历|任职|负责|担任|参与/.test(t);
    const hasEdu = /教育背景|学历|毕业|学位|本科|大专|硕士|博士|学校/.test(t);
    const hasSkill = /技能|能力|掌握|熟悉|精通|了解|熟练|擅长/.test(t);
    const hasSelf = /自我评价|个人简介|自我介绍|关于我|个人总结/.test(t);
    const structScore = (hasContact ? 20 : 0) + (hasWork ? 30 : 0) + (hasEdu ? 20 : 0) + (hasSkill ? 20 : 0) + (hasSelf ? 10 : 0);
    result.dimensions.push({
      name: '结构完整性',
      icon: 'ri-file-list-3-line',
      score: structScore,
      weight: 15,
      detail: `${5 - [!hasContact,!hasWork,!hasEdu,!hasSkill,!hasSelf].filter(Boolean).length}/5 模块`,
      color: structScore >= 80 ? '#2ea56a' : structScore >= 50 ? '#d97706' : '#dc2626'
    });

    // 3. 量化
    const quantScore = Math.min(100, quantified.length >= 5 ? 90 : quantified.length >= 3 ? 70 : quantified.length >= 1 ? 40 : 10);
    result.dimensions.push({
      name: '数据说服力',
      icon: 'ri-bar-chart-grouped-line',
      score: quantScore,
      weight: 20,
      detail: `${quantified.length} 处量化数据`,
      color: quantScore >= 70 ? '#2ea56a' : quantScore >= 40 ? '#d97706' : '#dc2626'
    });

    // 4. 动词力度
    const profScore = Math.min(100, Math.max(10, 50 + strongFound.length * 8 - weakFound.length * 12));
    result.dimensions.push({
      name: '动词力度',
      icon: 'ri-quill-pen-line',
      score: profScore,
      weight: 15,
      detail: `${strongFound.length} 强 / ${weakFound.length} 弱`,
      color: profScore >= 70 ? '#2ea56a' : profScore >= 40 ? '#d97706' : '#dc2626'
    });

    // 5. 关键词
    const kwScore = Math.min(100, hitKeywords.length * 8);
    result.dimensions.push({
      name: '关键词覆盖',
      icon: 'ri-key-2-line',
      score: kwScore,
      weight: 15,
      detail: `匹配 ${hitKeywords.length}/${skillKeywords.length}`,
      color: kwScore >= 70 ? '#2ea56a' : kwScore >= 40 ? '#d97706' : '#dc2626'
    });

    // 6. 信息密度
    const densityScore = Math.min(100, charCount < 200 ? 20 : charCount < 400 ? 40 : charCount < 1500 ? 80 : charCount < 2500 ? 70 : 50);
    result.dimensions.push({
      name: '信息密度',
      icon: 'ri-article-line',
      score: densityScore,
      weight: 15,
      detail: `约${wordCountApprox}字 / ${lineCount}行`,
      color: densityScore >= 70 ? '#2ea56a' : densityScore >= 40 ? '#d97706' : '#dc2626'
    });

    // 总分
    let total = 0;
    for (const d of result.dimensions) total += d.score * (d.weight / 100);
    result.totalScore = Math.round(total);

    if (total >= 80) result.summary = '简历整体质量较高。';
    else if (total >= 60) result.summary = '简历有基础，但多个维度有优化空间。';
    else if (total >= 40) result.summary = '简历存在明显短板，需要针对性优化。';
    else result.summary = '简历问题较多，建议按下方剖析逐项改进。';

    return result;
  }

  return {
    scoreJob, buildReport, gapSkills, gapCoursePlan, reasonText, jobById, courseById, levelOf, detectAgeBias, diagnoseResume
  };
}));
