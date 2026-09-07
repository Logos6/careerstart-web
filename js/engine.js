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

    // ==================== 生成深度剖析 ====================
    result.deepAnalysis = [];

    // ── 开篇：一句话定性 ──
    result.deepAnalysis.push({
      title: '简历总览',
      icon: 'ri-file-text-line',
      paragraphs: [
        charCount < 200
          ? `这份简历只有约 ${wordCountApprox} 字，信息量严重不足。HR 平均用 6-8 秒扫一份简历，你给他的信息甚至不够他读完一段话。一份合格的简历至少需要 500-800 字，覆盖工作经历、技能和教育背景。`
          : charCount < 500
          ? `这份简历约 ${wordCountApprox} 字，信息量偏少。对 HR 来说，这意味着他需要「猜」你的能力边界——而 HR 是不会猜的，信息不够就直接 Pass。`
          : charCount > 2000
          ? `这份简历约 ${wordCountApprox} 字，篇幅偏长。HR 的阅读习惯是「扫」而不是「读」，超过 1 页的简历有 80% 的内容不会被看到。建议精简到 1 页，把最有冲击力的内容留在前面。`
          : `这份简历约 ${wordCountApprox} 字，篇幅适中。接下来我会逐项帮你拆解，看哪些地方需要调整。`
      ]
    });

    // ── 弱化动词逐句剖析 ──
    if (weakHits.length > 0) {
      const section = {
        title: '表述力度诊断',
        icon: 'ri-quill-pen-line',
        paragraphs: [
          `你在简历中用了 ${weakHits.length} 处偏弱的动词。这个问题看似小事，但直接影响 HR 对你「是主角还是配角」的判断。逐句来看：`
        ]
      };
      weakHits.slice(0, 5).forEach((item, i) => {
        section.paragraphs.push(`${i + 1}. 你写的是「${item.sentence}」——${item.desc}`);
      });
      if (strongHits.length > 0) {
        section.paragraphs.push(`不过你简历里也出现了一些不错的动词，比如「${strongHits.slice(0, 3).join('、')}」。问题是用得不够统一，建议全文保持一致的高强度动词风格。`);
      }
      section.paragraphs.push(`改法很简单：把「负责/参与/协助」全部替换成「主导/统筹/推动/搭建/优化」。同一个意思，换一个词，HR 的感受完全不同。`);
      result.deepAnalysis.push(section);
    } else if (strongHits.length > 0) {
      result.deepAnalysis.push({
        title: '表述力度诊断',
        icon: 'ri-quill-pen-line',
        paragraphs: [
          `动词选择整体不错，用了「${strongHits.join('、')}」等专业动词，能有效传达你的主导权和执行力。继续保持这个风格。`
        ]
      });
    }

    // ── 数据说服力逐条剖析 ──
    const quantSection = {
      title: '数据说服力诊断',
      icon: 'ri-bar-chart-grouped-line',
      paragraphs: []
    };
    if (quantified.length >= 5) {
      quantSection.paragraphs.push(`你的简历包含 ${quantified.length} 处量化数据，在 35+ 求职者中属于较好水平。数据是简历里最有说服力的武器，你已经用起来了。`);
      quantified.slice(0, 3).forEach(q => {
        quantSection.paragraphs.push(`• 你写了「${q.context}」——这种有具体数字的表述，HR 一看就知道你做到了什么程度，比单纯说「负责XX工作」强十倍。`);
      });
      if (quantified.length > 5) {
        quantSection.paragraphs.push(`不过要检查一下：这些数据是你真实能力的体现，还是有夸大的成分？面试时 HR 可能会追问数据来源，确保每个数字都能自圆其说。`);
      }
    } else if (quantified.length > 0) {
      quantSection.paragraphs.push(`你的简历中仅找到 ${quantified.length} 处量化数据。这说明你有「用数据说话」的意识，但执行得还不够。`);
      quantified.forEach(q => {
        quantSection.paragraphs.push(`• 你写了「${q.context}」——这是好的开头，但一篇简历至少需要 5 个以上的数据点才能建立起「数据感」。`);
      });
      quantSection.paragraphs.push(`怎么补？回顾你每段工作经历，问自己三个问题：我管了多少人？花了多少钱？产出了多少？哪怕是估算的也比没有强。比如「管理 8 人团队」「负责 50 万预算」「服务 200+ 客户」「将处理时间从 3 天缩短到 4 小时」。`);
    } else {
      quantSection.paragraphs.push(
        `这是你简历最大的问题：整篇没有一个量化数据。`,
        `HR 看到「负责项目管理」会怎么想？管理了几个项目？多大规模？预算多少？团队多大？什么结果？——你一个都没回答。没有数据支撑的工作经历，在 HR 眼里约等于「没做过」。`,
        `35+ 求职者和应届生最大的区别，就是你有大量可量化的真实业绩。好好回忆一下：你带过多少人的团队？做过多少预算的项目？服务过多少客户？把数字写出来，你的简历说服力会翻倍。`
      );
    }
    result.deepAnalysis.push(quantSection);

    // ── 工作经历质量 ──
    if (vagueWorkLines.length > 0) {
      result.deepAnalysis.push({
        title: '工作经历质量诊断',
        icon: 'ri-briefcase-line',
        paragraphs: [
          `你有 ${vagueWorkLines.length} 条工作经历只描述了「做了什么」，完全没有说「做出了什么结果」。这是 35+ 简历中最常见的问题——把职责当成果写。`,
          `• 你写了「${vagueWorkLines[0].trim().substring(0, 80)}${vagueWorkLines[0].trim().length > 80 ? '...' : ''}」——这句话告诉 HR 你做了这件事，但没告诉他你做得好不好。`,
          `记住这个公式：<strong>动作动词 + 具体事项 + 量化结果</strong>。比如：`,
          `改前：负责项目管理工作`,
          `改后：主导 3 个并行项目交付，管理 8 人跨部门团队，项目按时交付率从 70% 提升至 95%`,
          `改前：协助部门完成日常行政工作`,
          `改后：统筹部门年度预算 120 万，优化采购流程后节省 15% 支出，连续两年零超支`
        ]
      });
    }

    // ── 空窗期 ──
    if (years.length >= 2) {
      const gaps = [];
      for (let i = 1; i < years.length; i++) {
        const diff = years[i] - years[i - 1];
        if (diff > 1) gaps.push({ from: years[i - 1], to: years[i], months: diff * 12 });
      }
      if (gaps.length > 0) {
        const gapSection = { title: '时间线诊断', icon: 'ri-calendar-timeline-line', paragraphs: [] };
        gaps.forEach(g => {
          const hasExplanation = /学习|进修|考证|培训|照顾|育儿|自由职业|创业|兼职|全职妈妈|家庭/.test(t);
          if (hasExplanation) {
            gapSection.paragraphs.push(
              `从 ${g.from} 年到 ${g.to} 年之间有约 ${g.months} 个月的空白。你简历中提到了这段时间在做什么，这是对的——HR 不怕空白，怕的是没有解释的空白。`
            );
          } else {
            gapSection.paragraphs.push(
              `从 ${g.from} 年到 ${g.to} 年之间有约 ${g.months} 个月的空白，而且没有做任何解释。HR 看到空白期会本能地怀疑：这人在干什么？是不是被裁了？能力不行找不到工作？`,
              `正面解释反而能加分。比如：「期间全职照顾家人，同时完成了 PMP 认证和 Python 在线课程」「期间自由职业，为 3 家中小企业提供咨询服务」。把空白变成成长故事。`
            );
          }
        });
        result.deepAnalysis.push(gapSection);
      }
    }

    // ── 关键词 ──
    if (hitKeywords.length < 8) {
      const missingKw = skillKeywords.filter(k => !t.includes(k));
      result.deepAnalysis.push({
        title: 'ATS 关键词诊断',
        icon: 'ri-key-2-line',
        paragraphs: [
          `你的简历只匹配了 ${hitKeywords.length} 个核心能力关键词（共 ${skillKeywords.length} 个）。现在超过 70% 的企业用 ATS（简历筛选系统）自动过滤，关键词不足意味着你的简历在系统层面就会被筛掉，HR 根本看不到。`,
          `• 缺失的关键词：${missingKw.join('、')}。`,
          `• 怎么补？不需要生硬堆砌，而是在描述工作经历时自然带入。比如你做过销售相关工作，就在描述中加入「销售管理」「市场分析」「客户运营」等词。`
        ]
      });
    }

    // ── 年龄歧视 ──
    if (ageBias.issues.length > 0) {
      result.deepAnalysis.push({
        title: '年龄歧视风险',
        icon: 'ri-shield-check-line',
        paragraphs: [
          `你的简历中有 ${ageBias.issues.length} 处可能触发 ATS 或 HR 自动筛除的表述：`,
          ...ageBias.issues.map(i => `• 「${i.word}」——${i.desc}。改为：${i.suggestion}`),
          `35+ 求职者的简历要格外注意这一点。很多 HR 看到年龄相关关键词会直接跳过，不是因为你能力不行，而是系统先把你的简历过滤了。`
        ]
      });
    }

    // ── 自我评价 ──
    if (selfContent) {
      const genericWords = selfContent.match(/热爱|喜欢|积极|乐观|认真|负责|团队|学习|抗压|沟通|踏实|勤奋|细心/g) || [];
      if (genericWords.length >= 3) {
        result.deepAnalysis.push({
          title: '自我评价诊断',
          icon: 'ri-user-heart-line',
          paragraphs: [
            `你的自我评价里出现了「${[...new Set(genericWords)].slice(0, 5).join('、')}」这类词。问题是：90% 的简历都在用这些词，HR 已经完全免疫了。`,
            `自我评价应该是一个「微型卖点」，用一句话概括你最大的竞争力。比如：`,
            `改前：「本人性格开朗，工作认真负责，有团队精神」`,
            `改后：「10 年供应链管理经验，主导过 3 次仓库系统迁移，累计节省物流成本 200 万+」`,
            `前者 HR 看了等于没看，后者 HR 会想：这个人有点东西，我要仔细看看他的工作经历。`
          ]
        });
      }
    }

    // ── 技能描述 ──
    if (skillLines.length > 0) {
      const skillGeneric = skillLines.filter(l => /Office|Word|Excel|PPT|普通话|英语|计算机/.test(l));
      if (skillGeneric.length > 0 && skillLines.length <= 4) {
        result.deepAnalysis.push({
          title: '技能描述诊断',
          icon: 'ri-tools-line',
          paragraphs: [
            `你的技能模块主要列的是「${skillGeneric.map(l => l.trim().substring(0, 15)).join('、')}」这类通用技能。问题是：这些是 35+ 求职者的标配，不是加分项。HR 看到「精通 Office」的反应是：这不是应该的吗？`,
            `35+ 求职者的技能模块应该突出「不可替代性」——你有什么是年轻候选人没有的？比如行业 Know-how、特定系统经验、管理能力、客户资源等。`
          ]
        });
      }
    }

    // ── 总结 ──
    const issueCount = weakHits.length + (quantified.length < 3 ? 1 : 0) + vagueWorkLines.length + (ageBias.issues.length > 0 ? 1 : 0);
    if (issueCount > 3) {
      result.deepAnalysis.push({
        title: '整体建议',
        icon: 'ri-lightbulb-line',
        paragraphs: [
          `你的简历有 ${issueCount} 个需要改进的地方。好消息是：这些问题都不难改，改完之后效果会非常明显。`,
          `最值得优先处理的两件事：`,
          `1. <strong>补数据</strong>——给每段工作经历加上 1-2 个量化成果，这是 35+ 简历最大的差异化武器。`,
          `2. <strong>换动词</strong>——把所有「负责/参与/协助」替换成「主导/统筹/推动」，一个字的改变，HR 的感受完全不同。`,
          `这两件事做完，你的简历质量至少提升 30%。`
        ]
      });
    } else if (issueCount > 0) {
      result.deepAnalysis.push({
        title: '整体建议',
        icon: 'ri-lightbulb-line',
        paragraphs: [
          `你的简历基础不错，只有 ${issueCount} 个小问题需要调整。改完这些细节，面试邀约率会进一步提升。`
        ]
      });
    } else {
      result.deepAnalysis.push({
        title: '整体建议',
        icon: 'ri-lightbulb-line',
        paragraphs: [
          `你的简历整体质量很高，没有发现明显的硬伤。保持这个水平，针对目标岗位稍作定制化调整即可。`
        ]
      });
    }

    // ==================== 六维度评分 ====================
    result.dimensions.push({
      name: '年龄歧视风险',
      icon: 'ri-shield-check-line',
      score: Math.max(0, 100 - ageBias.score),
      weight: 20,
      detail: ageBias.issues.length ? `${ageBias.issues.length} 处风险` : '安全',
      color: ageBias.riskColor
    });

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

    const quantScore = Math.min(100, quantified.length >= 5 ? 90 : quantified.length >= 3 ? 70 : quantified.length >= 1 ? 40 : 10);
    result.dimensions.push({
      name: '数据说服力',
      icon: 'ri-bar-chart-grouped-line',
      score: quantScore,
      weight: 20,
      detail: `${quantified.length} 处量化数据`,
      color: quantScore >= 70 ? '#2ea56a' : quantScore >= 40 ? '#d97706' : '#dc2626'
    });

    const profScore = Math.min(100, Math.max(10, 50 + strongHits.length * 8 - weakHits.length * 12));
    result.dimensions.push({
      name: '动词力度',
      icon: 'ri-quill-pen-line',
      score: profScore,
      weight: 15,
      detail: `${strongHits.length} 强 / ${weakHits.length} 弱`,
      color: profScore >= 70 ? '#2ea56a' : profScore >= 40 ? '#d97706' : '#dc2626'
    });

    const kwScore = Math.min(100, hitKeywords.length * 8);
    result.dimensions.push({
      name: '关键词覆盖',
      icon: 'ri-key-2-line',
      score: kwScore,
      weight: 15,
      detail: `匹配 ${hitKeywords.length}/${skillKeywords.length}`,
      color: kwScore >= 70 ? '#2ea56a' : kwScore >= 40 ? '#d97706' : '#dc2626'
    });

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
    else if (total >= 60) result.summary = '简历有基础，多个维度有优化空间。';
    else if (total >= 40) result.summary = '简历存在明显短板，需针对性优化。';
    else result.summary = '问题较多，建议按下方剖析逐项改进。';

    return result;
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
