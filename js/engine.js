// Web 网页端通用计算逻辑与数据接口 v2.0
// 7维评分模型：兴趣聚类×30% + 技能覆盖×25% + 性格适配×18% + 偏好兼容×12% + 人设匹配×8% + 经验迁移×5% + 置信度×2%

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./data.js'));
  } else {
    root.CareerEngine = factory(root.CareerData);
  }
}(typeof self !== 'undefined' ? self : this, function (D) {

  const INTERESTS = D.INTERESTS;
  const INTEREST_GROUPS = D.INTEREST_GROUPS;
  const SKILL_GROUPS = D.SKILL_GROUPS;
  const TRAITS = D.TRAITS;
  const PREF_ITEMS = D.PREF_ITEMS;
  const PREF_GROUPS = D.PREF_GROUPS;
  const JOBS = D.JOBS;

  const ALL_SKILLS = SKILL_GROUPS.flatMap(g => g.items);
  const SKILL_LABELS = Object.fromEntries(ALL_SKILLS.map(x => [x.id, x.label]));
  const PERSONA_NAMES = { mid: "35+ 重新出发", mom: "宝妈重返职场" };

  // ==================== 兴趣聚类映射 ====================
  // 将67个细粒度兴趣ID映射到岗位fit数据使用的粗粒度key
  const INTEREST_CLUSTER_MAP = {
    // 互联网与科技 → tech
    tech: ['tech','ecom','soft','data','ai','game','social','finintech','iot','iot2','enterprise'],
    // 金融与商务 → finance, business
    finance: ['bank','insurance','invest','finother','audit','finance'],
    business: ['consulting','hr','business','trade','sales','retail'],
    // 制造与工程 → make
    make: ['auto','auto2','auto3','newenergy','material','textile','furniture','elec','energy','make','construct','construct2','construct3','realestate','realestate2'],
    // 教育与培训 → care, people
    care: ['edu','edu2','medical','medical2','beauty','health','pharma','care'],
    // 媒体与文化 → media, design
    media: ['media','ad','art','design'],
    // 专业服务 → service
    service: ['legal','service','admin','security','logistics','transport','food','life','life2','hospitality','tourism','farming','people','nature'],
  };

  // 反向映射：粗粒度key → 细粒度兴趣ID列表
  const CLUSTER_TO_INTERESTS = {};
  for (const [cluster, ids] of Object.entries(INTEREST_CLUSTER_MAP)) {
    for (const id of ids) {
      if (!CLUSTER_TO_INTERESTS[id]) CLUSTER_TO_INTERESTS[id] = [];
      CLUSTER_TO_INTERESTS[id].push(cluster);
    }
  }

  // ==================== 技能聚类映射 ====================
  // 相近技能可以互相迁移，降低缺口惩罚
  const SKILL_CLUSTER = {
    '办公通用': ['office','wps','typing','file','meeting','reception','scheduling','correspond','stamp','asset','purchase','inventory'],
    '数字技术': ['coding','frontend','backend','mobile','database','datatool','aitool','pm','testing','network','cloud2','security','linux','git','api'],
    '设计创意': ['uidesign','graphic','logo','poster','packaging','interior','cad','3d','animation','video','photo','retouch','handwrite','typeset'],
    '写作内容': ['writing','copywriting','seo','article','script','translate','edit','proofread','brand','pr'],
    '语言能力': ['foreign','english','japanese','korean','french','german','spanish','arabic','russian','thai','vietnamese','portuguese','cantonese'],
    '演讲沟通': ['speaking','train','negotiate','host','persuade','listen','mediation'],
    '销售市场': ['sales','b2b','b2c','telemark','online','channel','market','promote','fission','operate','data2','content2','community2','live2'],
    '管理协调': ['coordinate','team','lead','plan','delegate','review','mentor','change','risk','budget'],
    '财务法务': ['accounting','tax','audit2','finance','cost','law','contract','ip','compliance','labor'],
    '人力行政': ['recruit','interview','onboard','train2','payroll','social2','employee','hrsystem','doc2','secretary'],
    '运营电商': ['shop','product','price','ads','seo2','crm','aftermarket','logistics2','quality2','complain'],
    '教育培训': ['teach','lesson','classroom','student','exam','tutor2','online2','courseware'],
    '客服服务': ['hotline','complaint','vip','survey','after','visit','counsel'],
    '医疗健康': ['nurse','pharm','diagnose','rehab','nutrition','acupuncture','elder2','child2','psych2','firstaid'],
    '制造技术': ['drive','repair','weld','electric','plumb','machine','assemble','inspect','blueprint','safety','warehouse','forklift'],
    '生活服务': ['cook','bake','barista','floral','hair','nail','makeup','clean','laundry','moving','lock','appliance','sewing'],
    '农业畜牧': ['farm','breed','fish','forest','irrigation','agriproduct','agritech'],
  };

  // 技能ID → 所属聚类
  const SKILL_TO_CLUSTER = {};
  for (const [cluster, ids] of Object.entries(SKILL_CLUSTER)) {
    for (const id of ids) {
      SKILL_TO_CLUSTER[id] = cluster;
    }
  }

  // ==================== 偏好冲突矩阵 ====================
  // 定义互斥偏好对：如果用户选了A但岗位需要B，扣分
  const PREF_CONFLICTS = {
    remote: ['outdoor','field','travel'],
    solo: ['team'],
    lowstress: ['challenge','fast'],
    stable: ['startup'],
    lowot: ['fast','challenge'],
    parttime: ['highpay','growth'],
    noshift: [],
    flextime: ['early96','early10'],
    weekend: ['6day'],
    bigco: ['smallco','startup'],
    state: ['startup','foreign'],
    smallco: ['bigco','state'],
    startup: ['bigco','state','stable','stable2'],
    foreign: ['state'],
    routine: ['diverse','challenge'],
    local: ['outdoor','field','travel'],
  };

  // ==================== 岗位类别 → 人设权重映射 ====================
  // 不同类别岗位对35+/宝妈的友好度不同，动态调整人设权重
  const PERSONA_WEIGHT_BY_CAT = {
    '教育': 0.15, '健康': 0.12, '职能': 0.10, '社区': 0.12,
    '灵活就业': 0.08, '销售': 0.06, '互联网': 0.04, '管理': 0.05,
    '制造': 0.05, '电商': 0.05, '咨询': 0.04, '农业': 0.08,
    '默认': 0.06,
  };

  // ==================== 核心评分函数 ====================

  /**
   * 维度1：兴趣聚类匹配（权重30%）
   * 将用户选择的67个细粒度兴趣映射到粗粒度聚类，再与岗位fit比较
   */
  function scoreInterest(userInterests, jobFit) {
    if (!userInterests || !userInterests.length || !jobFit || !jobFit.interests) return 0;

    // 将用户兴趣展开为粗粒度聚类
    const userClusters = new Set();
    for (const id of userInterests) {
      const clusters = CLUSTER_TO_INTERESTS[id] || [];
      clusters.forEach(c => userClusters.add(c));
    }

    if (userClusters.size === 0) return 0;

    // 计算聚类匹配
    let matchSum = 0, matchCount = 0;
    for (const cluster of userClusters) {
      const weight = jobFit.interests[cluster] || 0;
      if (weight > 0) {
        matchSum += weight;
        matchCount++;
      }
    }

    const coverage = matchCount / userClusters.size;
    const strength = matchCount > 0 ? matchSum / matchCount : 0;

    // 覆盖度和强度的加权组合（覆盖度更重要）
    return strength * (0.5 + 0.5 * coverage);
  }

  /**
   * 维度2：技能覆盖与缺口分析（权重25%）
   * 匹配已有技能 + 分析技能缺口严重度 + 临近技能迁移
   */
  function scoreSkill(userSkills, jobFit) {
    if (!userSkills || !userSkills.length || !jobFit || !jobFit.skills) return { score: 0, gapSkills: [], strongSkills: [] };

    const jobSkills = jobFit.skills;
    const userSet = new Set(userSkills);

    // 2a. 已有技能匹配
    let matchedSum = 0, matchCount = 0;
    const strongSkills = [];
    for (const skillId of userSkills) {
      const w = jobSkills[skillId] || 0;
      if (w > 0) {
        matchedSum += w;
        matchCount++;
        if (w >= 0.7) strongSkills.push(skillId);
      }
    }
    const matchScore = matchCount > 0 ? Math.min(1, matchedSum / Math.max(2, userSkills.length * 0.6)) : 0;

    // 2b. 技能缺口分析
    const requiredSkills = Object.entries(jobSkills).filter(([, w]) => w >= 0.5);
    const gapSkills = [];
    let gapPenalty = 0;
    for (const [skillId, weight] of requiredSkills) {
      if (!userSet.has(skillId)) {
        gapSkills.push({ id: skillId, weight, cluster: SKILL_TO_CLUSTER[skillId] || '' });
        gapPenalty += weight * 0.15; // 每个缺口按权重的15%扣分
      }
    }

    // 2c. 临近技能迁移奖励
    let transferBonus = 0;
    for (const gap of gapSkills) {
      if (!gap.cluster) continue;
      const clusterSkills = SKILL_CLUSTER[gap.cluster] || [];
      for (const userSkill of userSkills) {
        if (clusterSkills.includes(userSkill)) {
          transferBonus += 0.05; // 同聚类技能提供5%迁移奖励
          break;
        }
      }
    }

    const finalScore = Math.max(0, Math.min(1, matchScore - gapPenalty + transferBonus));
    return { score: finalScore, gapSkills, strongSkills };
  }

  /**
   * 维度3：性格特质适配（权重18%）
   * 加权平均 + 最低门槛检测
   */
  function scoreTrait(userTraits, jobFit) {
    if (!userTraits || !jobFit || !jobFit.traits) return { score: 0, topTrait: null, gapTraits: [] };

    const jobTraits = jobFit.traits;
    let weightedSum = 0, totalWeight = 0;
    const gapTraits = [];
    let topTrait = { label: '', score: 0 };

    for (const t of TRAITS) {
      const userScore = (userTraits[t.id] || 5) / 10; // 归一化到0-1
      const jobWeight = jobTraits[t.id] || 0.3;
      weightedSum += userScore * jobWeight;
      totalWeight += jobWeight;

      // 记录最强特质
      if (userScore > topTrait.score) {
        topTrait = { label: t.label, score: userScore, id: t.id };
      }

      // 岗位高要求但用户低分的特质
      if (jobWeight >= 0.8 && userScore < 0.6) {
        gapTraits.push({ label: t.label, userScore: Math.round(userScore * 10), jobWeight });
      }
    }

    const score = totalWeight > 0 ? weightedSum / totalWeight : 0;
    return { score, topTrait, gapTraits };
  }

  /**
   * 维度4：工作偏好兼容（权重12%）
   * 匹配偏好 + 冲突检测 + 协商空间
   */
  function scorePref(userPrefs, jobFit) {
    if (!userPrefs || !userPrefs.length || !jobFit || !jobFit.prefs) return { score: 0.5, conflicts: [], matchedPrefs: [] };

    const jobPrefs = jobFit.prefs;
    let matchSum = 0, conflictSum = 0;
    const matchedPrefs = [];
    const conflicts = [];

    for (const prefId of userPrefs) {
      const jobWeight = jobPrefs[prefId] || 0;

      // 直接匹配
      if (jobWeight >= 0.5) {
        matchSum += jobWeight;
        matchedPrefs.push(prefId);
      }

      // 冲突检测
      const conflictKeys = PREF_CONFLICTS[prefId] || [];
      for (const conflictKey of conflictKeys) {
        if (jobPrefs[conflictKey] && jobPrefs[conflictKey] >= 0.6) {
          conflictSum += 0.2;
          conflicts.push({ user: prefId, job: conflictKey });
        }
      }
    }

    const matchScore = userPrefs.length > 0 ? matchSum / userPrefs.length : 0.5;
    const finalScore = Math.max(0, Math.min(1, matchScore - conflictSum * 0.3));

    return { score: finalScore, conflicts, matchedPrefs };
  }

  /**
   * 维度5：人设适配（权重8%，动态调整）
   * 根据岗位类别动态调整人设权重
   */
  function scorePersona(persona, job, userPersona) {
    if (!persona || !job || !userPersona) return { score: 0.7, weight: 0.06 };

    // 动态权重：根据岗位类别调整
    let weight = PERSONA_WEIGHT_BY_CAT['默认'];
    for (const [key, w] of Object.entries(PERSONA_WEIGHT_BY_CAT)) {
      if (job.cat && job.cat.includes(key)) {
        weight = w;
        break;
      }
    }

    const score = persona[userPersona] || 0.7;
    return { score, weight };
  }

  /**
   * 维度6：经验迁移度（权重5%）
   * 评估用户背景与岗位的匹配程度
   */
  function scoreTransfer(userSkills, jobFit, userPersona) {
    if (!userSkills || !userSkills.length) return 0.5;

    // 计算技能多样性（跨聚类数量）
    const clusters = new Set();
    for (const skillId of userSkills) {
      const cluster = SKILL_TO_CLUSTER[skillId];
      if (cluster) clusters.add(cluster);
    }
    const diversity = Math.min(1, clusters.size / 5); // 5个聚类以上为满分

    // 35+和宝妈有经验迁移优势
    const personaBonus = (userPersona === 'mid' || userPersona === 'mom') ? 0.15 : 0;

    return Math.min(1, diversity * 0.7 + personaBonus + 0.15);
  }

  /**
   * 维度7：置信度（权重2%）
   * 基于数据完整度评估匹配结果的可信度
   */
  function scoreConfidence(answers) {
    let completeness = 0;
    const total = 5; // 5个维度

    if (answers.interests && answers.interests.length > 0) completeness++;
    if (answers.skills && answers.skills.length > 0) completeness++;
    if (answers.traits) {
      const traitValues = Object.values(answers.traits);
      if (traitValues.some(v => v !== 5)) completeness++; // 至少改过一个默认值
    }
    if (answers.prefs && answers.prefs.length > 0) completeness++;
    if (answers.persona) completeness++;

    return completeness / total;
  }

  // ==================== 综合计算六维能力分 ====================
  // 基于用户全部回答（兴趣+技能+偏好+人设+滑块）综合推算
  function computeTraitScores(a) {
    if (!a) return { logic: 5, creative: 5, social: 5, exec: 5, leader: 5, handcraft: 5 };

    const slider = a.traits || {};
    const interests = new Set(a.interests || []);
    const skills = new Set(a.skills || []);
    const prefs = new Set(a.prefs || []);

    // 信号映射：每个维度从哪些选项获取加分/减分信号
    const signals = {
      logic:   { interest: ['tech','data','finance','edu'], skill: ['coding','datatool','pm','accounting','finance','database','audit2'], pref: ['lowstress','routine'], boost: 0 },
      creative:{ interest: ['media','design','art'], skill: ['uidesign','graphic','video','photo','writing','copywriting','animation','handwrite'], pref: ['diverse','challenge'], boost: 0 },
      social:  { interest: ['people','sales','care'], skill: ['speaking','train','negotiate','host','persuade','listen','sales','b2b','b2c'], pref: ['team','social','outdoor'], boost: 0 },
      exec:    { interest: ['business','tech'], skill: ['pm','coordinate','plan','delegate','office','wps'], pref: ['fast','challenge','highpay'], boost: 0 },
      leader:  { interest: ['business'], skill: ['team','lead','plan','delegate','review','mentor','pm'], pref: ['growth','highpay','autonomy'], boost: 0 },
      handcraft:{ interest: ['make'], skill: ['repair','weld','electric','machine','cook','bake','sewing','drive'], pref: ['outdoor','field'], boost: 0 },
    };

    // 从兴趣收集信号
    for (const id of interests) {
      const clusters = CLUSTER_TO_INTERESTS[id] || [];
      for (const [trait, cfg] of Object.entries(signals)) {
        if (cfg.interest.some(k => clusters.includes(k) || id === k)) {
          cfg.boost += 0.6;
        }
      }
    }

    // 从技能收集信号（技能权重更高）
    for (const id of skills) {
      const cluster = SKILL_TO_CLUSTER[id];
      for (const [trait, cfg] of Object.entries(signals)) {
        if (cfg.skill.some(k => k === id || (cluster && cfg.skill.includes(k)))) {
          cfg.boost += 0.8;
        }
      }
    }

    // 从偏好收集信号（弱信号）
    for (const id of prefs) {
      for (const [trait, cfg] of Object.entries(signals)) {
        if (cfg.pref.includes(id)) {
          cfg.boost += 0.3;
        }
      }
    }

    // 人设加成：35+和宝妈在某些维度有经验优势
    if (a.persona === 'mid' || a.persona === 'mom') {
      signals.social.boost += 0.5;
      signals.exec.boost += 0.3;
      signals.leader.boost += 0.2;
    }

    // 综合计算：滑块自评 40% + 行为信号推算 60%
    const result = {};
    for (const t of TRAITS) {
      const selfScore = (slider[t.id] !== undefined ? slider[t.id] : 5);
      const signalBoost = signals[t.id].boost;
      // 信号推算分：基础5分 + 加成，上限10
      const signalScore = Math.min(10, 5 + signalBoost);
      // 加权融合
      result[t.id] = Math.round(selfScore * 0.4 + signalScore * 0.6);
    }

    return result;
  }

  // ==================== 综合评分 ====================

  function scoreJob(job, a) {
    // 1. 兴趣聚类匹配（30%）
    const interestScore = scoreInterest(a.interests, job.fit);

    // 2. 技能覆盖与缺口（25%）
    const skillResult = scoreSkill(a.skills, job.fit);

    // 3. 性格特质适配（18%）
    const traitResult = scoreTrait(a.traits, job.fit);

    // 4. 工作偏好兼容（12%）
    const prefResult = scorePref(a.prefs, job.fit);

    // 5. 人设适配（动态权重）
    const personaResult = scorePersona(job.persona, job, a.persona);

    // 6. 经验迁移度（5%）
    const transferScore = scoreTransfer(a.skills, job.fit, a.persona);

    // 7. 置信度（2%）
    const confidence = scoreConfidence(a);

    // 加权求和（人设权重动态调整，其余固定）
    const fixedWeight = 1 - personaResult.weight;
    const total = interestScore * 0.30
      + skillResult.score * 0.25
      + traitResult.score * 0.18
      + prefResult.score * 0.12
      + personaResult.score * personaResult.weight
      + transferScore * 0.05
      + confidence * 0.02;

    // 置信度修正：数据不完整时降低总分
    const confidenceMultiplier = 0.7 + 0.3 * confidence;

    return {
      total: Math.round(total * confidenceMultiplier * 100),
      parts: {
        interest: interestScore,
        skill: skillResult.score,
        trait: traitResult.score,
        pref: prefResult.score,
        persona: personaResult.score,
        transfer: transferScore,
        confidence: confidence,
      },
      details: {
        strongSkills: skillResult.strongSkills,
        gapSkills: skillResult.gapSkills,
        topTrait: traitResult.topTrait,
        gapTraits: traitResult.gapTraits,
        matchedPrefs: prefResult.matchedPrefs,
        prefConflicts: prefResult.conflicts,
        personaWeight: personaResult.weight,
      }
    };
  }

  function buildReport(a) {
    if (!a || !JOBS || JOBS.length === 0) {
      return { time: Date.now(), persona: '', interests: [], skills: [], traits: {}, prefs: [], top: [], alt: null };
    }
    const scored = JOBS.map(j => ({ job: j, ...scoreJob(j, a) }))
      .sort((x, y) => y.total - x.total);
    const top = scored.slice(0, 3);
    const top1 = top[0];
    if (!top1) {
      return { time: Date.now(), persona: a.persona, interests: a.interests, skills: a.skills, traits: a.traits, prefs: a.prefs, top: [], alt: null };
    }
    const top1Major = top1.job.cat ? top1.job.cat.split(" ")[0] : '';
    const alt = scored.find(s => s.job.cat ? s.job.cat.split(" ")[0] !== top1Major && s.total >= 50 : false) || scored[3] || null;
    return {
      time: Date.now(),
      persona: a.persona,
      interests: [...(a.interests || [])],
      skills: [...(a.skills || [])],
      traits: { ...(a.traits || {}) },
      prefs: [...(a.prefs || [])],
      top,
      alt,
      allScored: scored,
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
      risks: findRisks(scores, sections, timeline, achievements, weakPhrases, contacts, skills, t),
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

  function findRisks(scores, sections, timeline, achievements, weakPhrases, contacts, skills, text) {
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

  // ==================== 测评深度分析引擎 v2.0 ====================
  function generateAssessmentAnalysis(a, report) {
    const sections = [];
    if (!report || !report.top || report.top.length === 0) {
      sections.push({ title: '综合建议', icon: 'ri-lightbulb-flash-line', paragraphs: ['暂无匹配数据，请重新完成测评。'] });
      return sections;
    }

    const top1 = report.top[0];
    const top1Details = top1.details || {};

    // ── 1. 你是谁（含置信度） ──
    const personaLabel = a.persona === 'mom' ? '全职妈妈' : '35+ 职场人';
    const personaDesc = a.persona === 'mom'
      ? '你正处于重返职场的关键阶段。全职照顾家庭的经历并不是「空白期」，而是一段积累了耐心、时间管理、多任务处理能力的成长期。关键是把这些能力翻译成职场语言。'
      : '你是一位有丰富职场经验的 35+ 求职者。多年的积累是你最大的资产——行业认知、人脉资源、处理复杂问题的能力，这些都是年轻候选人无法快速获得的。';
    const confidence = Math.round((top1.parts.confidence || 0.8) * 100);
    sections.push({
      title: '你的画像',
      icon: 'ri-user-star-line',
      paragraphs: [
        `作为「${personaLabel}」，${personaDesc}`,
        `本次测评数据完整度 ${confidence}%，匹配结果${confidence >= 80 ? '可信度较高' : '仅供参考，建议补充更多信息后重新测评'}。`
      ]
    });

    // ── 2. 兴趣驱动力（使用聚类匹配） ──
    if (a.interests && a.interests.length > 0) {
      const interestLabels = a.interests.map(id => INTERESTS.find(x => x.id === id)?.label).filter(Boolean);
      // 展示匹配的粗粒度聚类
      const userClusters = new Set();
      for (const id of a.interests) {
        const clusters = CLUSTER_TO_INTERESTS[id] || [];
        clusters.forEach(c => userClusters.add(c));
      }
      const clusterLabels = Array.from(userClusters);
      const matchPercent = Math.round(top1.parts.interest * 100);

      const interestSection = {
        title: '兴趣驱动力',
        icon: 'ri-compass-3-line',
        paragraphs: [
          `你选择了 ${interestLabels.length} 个兴趣方向，覆盖「${clusterLabels.join('、')}」等多个领域。兴趣不是「喜欢什么」这么简单——它决定了你在什么领域能自发投入、持续深耕而不觉得累。`,
          `兴趣匹配度 ${matchPercent}%——${matchPercent >= 70 ? '你选的兴趣方向与目标岗位高度吻合，工作中更容易进入心流状态' : matchPercent >= 50 ? '兴趣方向与岗位有一定重合，部分工作内容会让你有成就感' : '兴趣与岗位存在错位，跨领域入行需要更多适应期'}。`
        ]
      };
      sections.push(interestSection);
    }

    // ── 3. 技能盘点（含缺口分析 + 迁移技能） ──
    if (a.skills && a.skills.length > 0) {
      const skillLabels = a.skills.map(id => SKILL_LABELS[id]).filter(Boolean);
      const matchPercent = Math.round(top1.parts.skill * 100);
      const strongSkills = (top1Details.strongSkills || []).map(id => SKILL_LABELS[id]).filter(Boolean);
      const gapSkills = (top1Details.gapSkills || []).slice(0, 5);

      const skillSection = {
        title: '技能盘点',
        icon: 'ri-tools-line',
        paragraphs: [
          `你目前掌握的技能：${skillLabels.join('、')}。技能覆盖度 ${matchPercent}%。`
        ]
      };
      if (strongSkills.length > 0) {
        skillSection.paragraphs.push(
          `✅ 核心匹配技能：${strongSkills.join('、')}——这些是你的「硬通货」，在简历和面试中要重点展示实际应用案例。`
        );
      }
      if (gapSkills.length > 0) {
        const gapLabels = gapSkills.map(g => SKILL_LABELS[g.id] || g.id).join('、');
        // 检查是否有临近技能可迁移
        const transferable = gapSkills.filter(g => {
          const cluster = SKILL_TO_CLUSTER[g.id];
          if (!cluster) return false;
          const clusterSkills = SKILL_CLUSTER[cluster] || [];
          return a.skills.some(s => clusterSkills.includes(s));
        });
        skillSection.paragraphs.push(
          `⚠️ 技能缺口：${gapLabels}。${transferable.length > 0 ? '好消息是你已有同领域的临近技能，学习成本会大幅降低。' : '建议提前自学补上，或在简历中用相关经验证明你的学习能力。'}`
        );
      }
      sections.push(skillSection);
    }

    // ── 4. 性格特质（含差距分析） ──
    const sortedTraits = TRAITS.map(t => ({ ...t, score: a.traits[t.id] || 5 })).sort((x, y) => y.score - x.score);
    const topTraits = sortedTraits.slice(0, 2);
    const matchPercent = Math.round(top1.parts.trait * 100);
    const gapTraits = (top1Details.gapTraits || []);

    const traitSection = {
      title: '性格特质',
      icon: 'ri-brain-line',
      paragraphs: [
        `你的六维能力画像中，最突出的两个维度是「${topTraits[0].label}」（${topTraits[0].score}/10）和「${topTraits[1].label}」（${topTraits[1].score}/10）。`,
        `性格适配度 ${matchPercent}%。${top1Details.topTrait ? (top1.score >= 75 ? `「${top1Details.topTrait.label}」与目标岗位高度吻合，这是你面试时最值得强调的卖点。` : `「${top1Details.topTrait.label}」是你最突出的特质，但目标岗位更看重其他维度。`) : ''}`
      ]
    };
    if (gapTraits.length > 0) {
      const gapLabels = gapTraits.map(g => `「${g.label}」（你${g.userScore}/10，岗位要求${Math.round(g.jobWeight * 10)}/10）`).join('；');
      traitSection.paragraphs.push(
        `需要提升的维度：${gapLabels}。好消息是，性格特质不是固定不变的——你可以在工作中有意识地锻炼这些维度，用实际案例证明你的成长潜力。`
      );
    }
    sections.push(traitSection);

    // ── 5. 工作偏好（含冲突检测） ──
    if (a.prefs && a.prefs.length > 0) {
      const prefLabels = a.prefs.map(id => PREF_ITEMS.find(x => x.id === id)?.label).filter(Boolean);
      const matchPercent = Math.round(top1.parts.pref * 100);
      const matchedPrefs = (top1Details.matchedPrefs || []).map(id => PREF_ITEMS.find(x => x.id === id)?.label).filter(Boolean);
      const conflicts = top1Details.prefConflicts || [];

      const prefSection = {
        title: '工作偏好',
        icon: 'ri-heart-pulse-line',
        paragraphs: [
          `你期望的工作状态：${prefLabels.join('、')}。偏好兼容度 ${matchPercent}%。`
        ]
      };
      if (matchedPrefs.length > 0) {
        prefSection.paragraphs.push(
          `✅ 可满足偏好：${matchedPrefs.join('、')}。工作内容匹配决定你「能不能做」，而工作偏好匹配决定你「做得开不开心」。`
        );
      }
      if (conflicts.length > 0) {
        const conflictDesc = conflicts.map(c => {
          const userLabel = PREF_ITEMS.find(x => x.id === c.user)?.label || c.user;
          const jobLabel = PREF_ITEMS.find(x => x.id === c.job)?.label || c.job;
          return `你期望「${userLabel}」但岗位倾向「${jobLabel}」`;
        }).join('；');
        prefSection.paragraphs.push(
          `⚠️ 偏好冲突：${conflictDesc}。这不是说不能选这个岗位，而是你需要想清楚：这些偏好是你「必须有的底线」还是「最好有但可以妥协」的？`
        );
      }
      sections.push(prefSection);
    }

    // ── 6. 综合建议 ──
    const top2 = report.top[1];
    const top3 = report.top[2];
    const transferPercent = Math.round((top1.parts.transfer || 0.5) * 100);
    sections.push({
      title: '综合建议',
      icon: 'ri-lightbulb-flash-line',
      paragraphs: [
        `综合你的兴趣、技能、性格和偏好，你最匹配的方向是「${top1.job.name}」（匹配度 ${top1.total}%）。经验迁移度 ${transferPercent}%——${transferPercent >= 60 ? '你的技能组合跨领域覆盖较好，转型适应期会更短' : '建议聚焦目标领域，集中提升核心技能'}。`,
        top2 ? `备选方向是「${top2.job.name}」（${top2.total}%）和「${top3.job.name}」（${top3.total}%）。如果你对第一选择不确定，可以同时关注这两个方向。` : '',
        `接下来你可以：① 针对目标岗位优化简历（突出匹配的技能和经历）；② 查看「岗位详情」了解具体要求；③ 使用「AI 简历诊断」检查简历质量。`
      ].filter(Boolean)
    });

    return sections;
  }

  // ==================== 模拟面试引擎 ====================

  const INTERVIEW_QUESTIONS = {
    general: [
      { id: 'intro', category: '自我介绍', question: '请用 1-2 分钟简单介绍一下你自己，包括你的工作经验和核心优势。', tips: '结构：姓名→工作年限→核心技能→代表成果→求职意向', weight: 15 },
      { id: 'gap', category: '职业空白期', question: '我们注意到你的简历有一段职业空白期，请问这段时间你在做什么？为什么选择现在重返职场？', tips: '诚实说明原因（学习/照顾家人/创业尝试），强调这段时间的成长和收获', weight: 20 },
      { id: 'salary', category: '薪资期望', question: '你对薪资的期望是多少？能说说你的依据吗？', tips: '先说市场行情，再说个人能力，给一个合理区间而非固定数字', weight: 10 },
      { id: 'stress', category: '抗压能力', question: '如果入职后发现工作内容和预期有差距，或者需要加班，你会怎么处理？', tips: '表达适应能力和学习意愿，同时展现合理的职业规划', weight: 15 },
      { id: 'plan', category: '职业规划', question: '你未来 3 年的职业规划是什么？打算在我们公司怎么发展？', tips: '结合公司发展路径，展现稳定性和成长意愿', weight: 15 },
      { id: 'weakness', category: '自我认知', question: '你认为自己最大的弱点是什么？你是如何克服的？', tips: '真实但不致命，重点在改进措施和成长', weight: 15 },
      { id: 'value', category: '价值主张', question: '相比于年轻的候选人，你觉得你的核心竞争力是什么？', tips: '突出经验、稳定性、行业洞察、人脉资源等35+专属优势', weight: 20 }
    ],
    management: [
      { id: 'team', category: '团队管理', question: '你管理过多大的团队？如果团队成员不服从安排，你会怎么处理？', tips: '用具体案例说明管理方法和沟通技巧', weight: 20 },
      { id: 'conflict', category: '冲突处理', question: '请举例说明你是如何处理团队内部冲突的？结果如何？', tips: '用 STAR 法则：情境→任务→行动→结果', weight: 20 },
      { id: 'kpi', category: '目标达成', question: '你曾经设定过最有挑战性的 KPI 是什么？你是怎么达成的？', tips: '量化结果，说明策略和执行过程', weight: 20 }
    ],
    technical: [
      { id: 'skill', category: '专业技能', question: '你最近学习的新技能或工具是什么？为什么选择学这个？', tips: '展现学习能力和对行业趋势的关注', weight: 20 },
      { id: 'project', category: '项目经验', question: '请介绍一个你最满意的项目，你在其中承担什么角色？', tips: '突出个人贡献和可量化的成果', weight: 25 }
    ],
    service: [
      { id: 'customer', category: '客户服务', question: '遇到情绪激动的客户投诉，你会怎么处理？请举个实际例子。', tips: '先共情→再解决→后跟进，展现服务意识', weight: 20 },
      { id: 'rework', category: '重复工作', question: '这个岗位可能需要重复性的工作，你能接受吗？你有什么方法保持效率？', tips: '表达耐心和责任心，分享提高效率的方法', weight: 15 }
    ]
  };

  const INTERVIEW_STAGES = [
    { stage: 'greeting', label: '开场', icon: 'ri-hand-heart-line' },
    { stage: 'intro', label: '自我介绍', icon: 'ri-user-line' },
    { stage: 'core', label: '核心问题', icon: 'ri-questionnaire-line' },
    { stage: 'scenario', label: '情景模拟', icon: 'ri-chat-follow-up-line' },
    { stage: 'closing', label: '结束', icon: 'ri-flag-line' }
  ];

  function initInterviewSession(jobName) {
    const jobType = detectJobType(jobName);
    const questions = selectQuestions(jobType);
    
    return {
      jobName,
      jobType,
      questions,
      answers: [],
      currentQ: 0,
      stage: 'intro',
      scores: {},
      startTime: Date.now()
    };
  }

  function detectJobType(jobName) {
    const name = jobName.toLowerCase();
    if (/管理|主管|经理|总监|leader|manager/i.test(name)) return 'management';
    if (/开发|工程|技术|测试|运维|数据|IT| programmer/i.test(name)) return 'technical';
    if (/客服|服务|前台|接待|咨询/i.test(name)) return 'service';
    return 'general';
  }

  function selectQuestions(jobType) {
    const base = [...INTERVIEW_QUESTIONS.general];
    const extra = INTERVIEW_QUESTIONS[jobType] || [];
    
    // 打乱通用问题顺序
    for (let i = base.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [base[i], base[j]] = [base[j], base[i]];
    }

    // 选择 5 个通用 + 2 个专项
    const selected = base.slice(0, 5);
    const extraShuffled = extra.sort(() => Math.random() - 0.5).slice(0, 2);
    
    return [...selected, ...extraShuffled];
  }

  function analyzeAnswer(answer, question) {
    if (!answer || answer.trim().length < 5) {
      return { score: 10, level: '无效', feedback: '回答过短，请详细展开', keywords: [], suggestion: '建议至少说 2-3 句话，包含具体案例或数据' };
    }

    const text = answer.trim();
    const len = text.length;
    let score = 50; // 基础分

    // 1. 长度评分
    if (len >= 100) score += 15;
    else if (len >= 50) score += 10;
    else if (len >= 20) score += 5;
    else score -= 10;

    // 2. 结构化表达检测
    const structurePatterns = [
      /首先|第一|1[.、]/,
      /其次|第二|2[.、]/,
      /最后|第三|3[.、]/,
      /总结|总的来说|综上/
    ];
    const structureCount = structurePatterns.filter(p => p.test(text)).length;
    score += structureCount * 5;

    // 3. 量化数据检测
    const quantifyPattern = /\d+[%％万元人天次个月年]|提升了?\d+|增长了?\d+|节省了?\d+|带领\d+人|管理\d+/;
    if (quantifyPattern.test(text)) score += 10;

    // 4. 案例/经历描述
    const casePatterns = [
      /当时|有一次|曾经|之前|在.*公司/,
      /具体来说|举个例子|比如|例如/,
      /结果|最终|后来|最后/
    ];
    const caseCount = casePatterns.filter(p => p.test(text)).length;
    score += caseCount * 5;

    // 5. 积极/专业词汇
    const positiveWords = /主动|积极|负责|主导|统筹|推动|优化|提升|达成|突破|学习|成长|改进/;
    const positiveCount = (text.match(positiveWords) || []).length;
    score += Math.min(10, positiveCount * 3);

    // 6. 消极词汇扣分
    const negativeWords = /不知道|不清楚|随便|无所谓|还行|一般|可能|大概|应该/;
    const negativeCount = (text.match(negativeWords) || []).length;
    score -= negativeCount * 5;

    // 7. 套话检测
    const genericPhrases = /性格开朗|工作认真|吃苦耐劳|学习能力强|团队精神/;
    if (genericPhrases.test(text) && len < 50) score -= 10;

    // 限制分数范围
    score = Math.max(10, Math.min(100, score));

    // 评级
    let level, color;
    if (score >= 85) { level = '优秀'; color = '#16a34a'; }
    else if (score >= 70) { level = '良好'; color = '#2ea56a'; }
    else if (score >= 55) { level = '一般'; color = '#d97706'; }
    else { level = '较差'; color = '#dc2626'; }

    // 生成反馈
    const feedback = generateFeedback(score, text, question);

    // 提取关键词
    const keywords = extractKeywords(text);

    return { score, level, color, feedback, keywords, suggestion: feedback.suggestion };
  }

  function generateFeedback(score, text, question) {
    const parts = [];
    let suggestion = '';

    if (score >= 85) {
      parts.push('回答结构清晰，有具体案例支撑');
      suggestion = '保持这个水平，面试时注意语速和眼神交流';
    } else if (score >= 70) {
      parts.push('回答有条理，但可以更具体');
      suggestion = '建议补充 1-2 个量化数据或实际案例来增强说服力';
    } else if (score >= 55) {
      parts.push('回答基本完整，但缺乏亮点');
      suggestion = '用 STAR 法则重新组织：情境→任务→行动→结果';
    } else {
      parts.push('回答较简略，缺少实质内容');
      suggestion = '准备 2-3 个成功案例，每个用 3-4 句话讲清楚';
    }

    // 具体建议
    if (text.length < 50) parts.push('回答过短，建议展开到 100 字以上');
    if (!/\d+/.test(text)) parts.push('缺少量化数据，如数字、百分比、时间等');
    if (!/当时|有一次|曾经|之前/.test(text)) parts.push('缺少具体案例，建议用真实经历佐证');

    return { text: parts.join('；'), suggestion };
  }

  function extractKeywords(text) {
    const keywords = [];
    const patterns = [
      { regex: /管理|带领|统筹|领导/, cat: '管理' },
      { regex: /沟通|协调|协作|谈判/, cat: '沟通' },
      { regex: /数据|分析|报表|KPI/, cat: '数据' },
      { regex: /优化|提升|改进|效率/, cat: '优化' },
      { regex: /学习|培训|进修|考证/, cat: '学习' },
      { regex: /客户|用户|服务|满意度/, cat: '服务' },
      { regex: /项目|产品|上线|交付/, cat: '项目' }
    ];

    for (const p of patterns) {
      if (p.regex.test(text)) keywords.push(p.cat);
    }
    return keywords;
  }

  function getInterviewFeedback(session, userAnswer) {
    const q = session.questions[session.currentQ];
    const analysis = analyzeAnswer(userAnswer, q);

    // 保存答案
    session.answers.push({
      question: q,
      answer: userAnswer,
      analysis
    });

    // 生成追问或下一题
    const isLast = session.currentQ >= session.questions.length - 1;
    let aiResponse = '';

    if (isLast) {
      aiResponse = '感谢你的回答！面试到此结束，请稍候正在生成面试评估报告...';
    } else {
      // 根据回答质量决定追问还是下一题
      if (analysis.score < 50 && userAnswer.length > 20) {
        aiResponse = `你提到了「${analysis.keywords[0] || '某个方面'}」，能再具体说说吗？比如用一个实际案例来说明？`;
      } else {
        session.currentQ++;
        const nextQ = session.questions[session.currentQ];
        aiResponse = nextQ.question;
      }
    }

    return {
      feedback: analysis.feedback,
      score: analysis.score,
      level: analysis.level,
      isLast,
      aiResponse,
      progress: Math.round(((session.answers.length) / session.questions.length) * 100)
    };
  }

  function generateInterviewReport(session) {
    const totalScore = Math.round(session.answers.reduce((s, a) => s + a.analysis.score, 0) / session.answers.length);
    const duration = Math.round((Date.now() - session.startTime) / 1000);

    // 分类评分
    const categoryScores = {};
    for (const a of session.answers) {
      const cat = a.question.category;
      if (!categoryScores[cat]) categoryScores[cat] = [];
      categoryScores[cat].push(a.analysis.score);
    }
    const avgByCategory = {};
    for (const [cat, scores] of Object.entries(categoryScores)) {
      avgByCategory[cat] = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
    }

    // 找出强项和弱项
    const sorted = Object.entries(avgByCategory).sort((a, b) => b[1] - a[1]);
    const strengths = sorted.filter(([, s]) => s >= 70).map(([cat]) => cat);
    const weaknesses = sorted.filter(([, s]) => s < 60).map(([cat]) => cat);

    // 综合评级
    let level, color, suggestion;
    if (totalScore >= 85) {
      level = '面试表现优秀';
      color = '#16a34a';
      suggestion = '你的面试表现整体出色，建议保持自信和条理，面试时注意语速控制和眼神交流。';
    } else if (totalScore >= 70) {
      level = '面试表现良好';
      color = '#2ea56a';
      suggestion = '基础扎实，建议在薄弱环节重点准备，多用 STAR 法则组织回答。';
    } else if (totalScore >= 55) {
      level = '面试表现一般';
      color = '#d97706';
      suggestion = '有一定基础但缺乏亮点，建议准备 3-5 个成功案例并反复练习。';
    } else {
      level = '需要加强准备';
      color = '#dc2626';
      suggestion = '建议系统准备：① 梳理核心优势 ② 准备量化案例 ③ 反复模拟练习。';
    }

    // 收集所有关键词
    const allKeywords = [...new Set(session.answers.flatMap(a => a.analysis.keywords))];

    return {
      jobName: session.jobName,
      totalScore,
      level,
      color,
      suggestion,
      duration: `${Math.floor(duration / 60)}分${duration % 60}秒`,
      totalQuestions: session.questions.length,
      answeredQuestions: session.answers.length,
      categoryScores: avgByCategory,
      strengths,
      weaknesses,
      keywords: allKeywords,
      details: session.answers.map(a => ({
        question: a.question.question,
        category: a.question.category,
        answer: a.answer,
        score: a.analysis.score,
        level: a.analysis.level,
        color: a.analysis.color,
        feedback: a.analysis.feedback.text,
        suggestion: a.analysis.suggestion
      }))
    };
  }

  return {
    scoreJob, buildReport, gapSkills, gapCoursePlan, reasonText, jobById, courseById, levelOf, detectAgeBias, diagnoseResume, generateAssessmentAnalysis, computeTraitScores,
    initInterviewSession, getInterviewFeedback, generateInterviewReport
  };
}));
