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

  // ==================== 模拟面试引擎 v3.0 ====================
  // 23大类 · 345+道深度场景化题 · 无限轮次 · 智能追问

  const INTERVIEW_DB = {

    // ══════ 1. 通用基础 ══════
    general: [
      { id: 'g1', cat: '自我介绍', q: '请用2分钟介绍你自己，重点说清楚：你过去做过什么、擅长什么、为什么来应聘这个岗位。', tips: '不要念简历，用故事线串联经历', w: 15 },
      { id: 'g2', cat: '职业空白期', q: '你的简历有一段空白期。请如实告诉我这段时间你在做什么，以及你为什么选择现在重返职场？', tips: '诚实+成长视角', w: 20 },
      { id: 'g3', cat: '35+价值', q: '说实话，这个岗位可能有更年轻的候选人。你觉得你相比25岁的求职者，真正的优势在哪里？请用具体例子说明。', tips: '不要说"经验丰富"这种空话，要说具体场景', w: 25 },
      { id: 'g4', cat: '自我认知', q: '你认为自己最大的短板是什么？这个短板对你的工作产生过什么实际影响？你是怎么应对的？', tips: '真实但不致命，重点在改进措施', w: 20 },
      { id: 'g5', cat: '职业规划', q: '如果入职后发现实际工作内容和面试时谈的不一样，你会怎么处理？请说说你过去遇到类似情况的真实经历。', tips: '展现适应力和沟通能力', w: 20 },
      { id: 'g6', cat: '薪资谈判', q: '你期望的薪资是多少？如果我告诉你这个岗位的预算比你期望的低20%，你会怎么考虑？', tips: '先说市场调研依据，再给弹性区间', w: 15 },
      { id: 'g7', cat: '冲突处理', q: '请回忆一次你在工作中和同事或上级产生严重分歧的经历。你是怎么处理的？最终结果如何？', tips: '用STAR法则', w: 20 },
      { id: 'g8', cat: '失败复盘', q: '说一个你在工作中搞砸的事情。当时发生了什么？你从中学到了什么？后来有没有用到这个教训？', tips: '真实案例+深度反思+后续应用', w: 25 },
      { id: 'g9', cat: '抗压能力', q: '说一个你同时面对多个紧急任务的经历。你是怎么排优先级的？最终结果如何？', tips: '展现时间管理和压力管理能力', w: 20 },
      { id: 'g10', cat: '学习能力', q: '最近半年你学了什么新技能或新知识？为什么选这个？学了之后对工作有什么实际帮助？', tips: '具体+有应用场景', w: 20 },
      { id: 'g11', cat: '沟通表达', q: '请回忆一次你需要向不懂技术的领导汇报复杂问题的经历。你是怎么让他理解的？', tips: '展现翻译能力和结构化表达', w: 15 },
      { id: 'g12', cat: '责任心', q: '说一个你主动承担额外责任的例子。当时为什么选择站出来？结果怎么样？', tips: '展现主动性和担当', w: 15 },
      { id: 'g13', cat: '适应变化', q: '公司突然调整了业务方向，你负责的项目被叫转。你会怎么处理？请举一个真实例子。', tips: '展现灵活性和积极心态', w: 20 },
      { id: 'g14', cat: '职业动机', q: '你为什么选择这个行业/岗位？是什么让你在这个领域坚持下来的？', tips: '展现热情和长期主义', w: 15 },
      { id: 'g15', cat: '离职原因', q: '你从上一家公司离职的真实原因是什么？如果让你重新选择，你还会离职吗？', tips: '诚实但积极，不要抱怨前公司', w: 15 },
    ],

    // ══════ 2. 自我介绍与职业背景 ══════
    self_intro: [
      { id: 'si1', cat: '职业背景', q: '用3句话概括你的职业生涯，然后用一个具体案例证明其中最重要的一点。', tips: '精炼+案例支撑', w: 20 },
      { id: 'si2', cat: '核心优势', q: '如果只能选3个词来形容你的职业标签，你会选哪3个？请各用一个真实案例证明。', tips: '不要用"认真负责"这种空词', w: 20 },
      { id: 'si3', cat: '职业高光', q: '你职业生涯中最自豪的一件事是什么？这件事为什么对你意义重大？', tips: '选有数据、有影响的案例', w: 20 },
      { id: 'si4', cat: '转行经历', q: '如果你有过转行经历，请说说当时为什么转？转行后最大的挑战是什么？你怎么克服的？', tips: '展现决策逻辑和适应力', w: 25 },
      { id: 'si5', cat: '行业认知', q: '你对我们这个行业目前最大的痛点是什么？你认为未来3年会发生什么变化？', tips: '展现行业洞察力', w: 20 },
      { id: 'si6', cat: '岗位理解', q: '你认为这个岗位最重要的3项能力是什么？你在这些能力上的自评是多少分（满分10分）？', tips: '展现对岗位的深入理解', w: 20 },
      { id: 'si7', cat: '竞争优势', q: '和同等经验的候选人相比，你觉得自己最大的差异化优势是什么？', tips: '要具体，不要泛泛而谈', w: 20 },
      { id: 'si8', cat: '职业故事', q: '请讲一个能代表你职业态度的故事——不需要是成就，可以是一次教训、一个选择、或一个转折点。', tips: '真实+有深度+有反思', w: 25 },
      { id: 'si9', cat: '技能栈', q: '列出你最擅长的5项硬技能和5项软技能，并各举一个使用场景。', tips: '硬技能=工具/技术，软技能=沟通/协调等', w: 20 },
      { id: 'si10', cat: '职业阶段', q: '你觉得你目前处于职业生涯的哪个阶段？为什么？接下来你想往哪个方向发展？', tips: '展现自我认知和规划能力', w: 15 },
      { id: 'si11', cat: '工作风格', q: '你的工作风格是什么样的？你能接受什么样的管理方式？', tips: '真实描述+展现配合度', w: 15 },
      { id: 'si12', cat: '成就动机', q: '什么事情会让你产生强烈的成就感？你是怎么追求这种成就感的？', tips: '展现内在驱动力', w: 15 },
      { id: 'si13', cat: '失败经历', q: '说一个你职业生涯早期犯过的错误，当时的你是怎么处理的？如果现在的你回去，会怎么做？', tips: '展现成长轨迹', w: 20 },
      { id: 'si14', cat: '人脉资源', q: '你在行业里积累了哪些人脉资源？这些资源能为新岗位带来什么价值？', tips: '具体化，不要只说"认识很多人"', w: 20 },
      { id: 'si15', cat: '个人品牌', q: '如果让前同事用3个词形容你，你觉得他们会说什么？和你希望的一样吗？', tips: '展现自我认知vs他人评价的差距', w: 15 },
    ],

    // ══════ 3. 职业空白与重返职场 ══════
    career_gap: [
      { id: 'cg1', cat: '空白期', q: '你离开职场多久了？这段时间你做了哪些准备来让自己重新适应工作节奏？', tips: '学习/兼职/志愿者/社群运营都算准备', w: 20 },
      { id: 'cg2', cat: '重返动机', q: '是什么让你决定现在重返职场？而不是再等一段时间？', tips: '展现主动性和紧迫感', w: 15 },
      { id: 'cg3', cat: '技能更新', q: '你离开的这段时间，行业发生了哪些变化？你做了什么来跟上这些变化？', tips: '展现学习能力和行业敏感度', w: 20 },
      { id: 'cg4', cat: '顾虑坦白', q: '你最担心重返职场后遇到什么问题？你打算怎么应对？', tips: '坦诚说出真实顾虑+具体应对方案', w: 20 },
      { id: 'cg5', cat: '妈妈优势', q: '全职带娃这几年，你觉得你获得了哪些职场上用得到的能力？请举具体例子。', tips: '时间管理、多任务处理、情绪管理、谈判都是真实能力', w: 20 },
      { id: 'cg6', cat: '工作家庭', q: '如果项目截止日期和孩子生病撞在一起，你会怎么处理？请说说你的真实想法。', tips: '展现规划能力+应急预案+坦诚态度', w: 25 },
      { id: 'cg7', cat: '适应节奏', q: '重返职场后，你觉得最难适应的会是什么？你准备了什么应对方案？', tips: '具体化每个困难+解决方案', w: 20 },
      { id: 'cg8', cat: '精力分配', q: '你计划怎么分配工作和家庭的精力？有没有具体的时间管理方案？', tips: '展现规划能力，不要说"我会平衡好"', w: 20 },
      { id: 'cg9', cat: '期望管理', q: '你对重返职场后的第一份工作，最看重的3个条件是什么？请排序并说明理由。', tips: '展现理性思考', w: 15 },
      { id: 'cg10', cat: '过往复盘', q: '如果让你重新选择，你当初会做同样的决定（离开职场）吗？为什么？', tips: '展现反思能力和坦诚', w: 20 },
      { id: 'cg11', cat: '行业选择', q: '你为什么选择回到这个行业而不是尝试新的方向？', tips: '展现理性决策', w: 15 },
      { id: 'cg12', cat: '起步心态', q: '如果第一份工作的薪资比你离开前低30%，你能接受吗？你的底线是什么？', tips: '展现务实心态', w: 15 },
      { id: 'cg13', cat: '社会支持', q: '你的家人支持你重返职场吗？如果孩子需要照顾，你有备用方案吗？', tips: '展现准备充分', w: 15 },
      { id: 'cg14', cat: '职业连续性', q: '你离开前的工作经验和现在想做的工作之间，有什么关联？你怎么让面试官相信你能无缝衔接？', tips: '找到技能迁移点', w: 20 },
      { id: 'cg15', cat: '技能迁移', q: '你离开前的工作经验和现在想做的岗位之间，有哪些可迁移的技能？请举具体例子。', tips: '展现技能复用意识和务实心态', w: 15 },
    ],

    // ══════ 4. 管理与领导力 ══════
    management: [
      { id: 'm1', cat: '裁员决策', q: '假设你需要在团队中裁掉一个人，但有两个候选人各有利弊。你会用什么标准来决定？请模拟一下你会怎么和被裁的人谈。', tips: '考察决策逻辑+同理心+沟通能力', w: 25 },
      { id: 'm2', cat: '绩效改进', q: '你团队里有一个老员工，近两年绩效持续下滑，但态度没问题。你会怎么做？请说说你的具体步骤。', tips: '诊断原因→设定改进计划→定期跟进→结果评估', w: 25 },
      { id: 'm3', cat: '团队冲突', q: '你的两个核心下属闹矛盾，已经影响到项目进度。你作为管理者会怎么介入？请模拟你会说的话。', tips: '分别了解→找共同目标→制定协作规则→跟进', w: 20 },
      { id: 'm4', cat: '变革推动', q: '公司要推行一个新的工作流程，但团队抵触很大。你会怎么推动落地？请举一个你过去成功推动变革的例子。', tips: '变革管理：愿景沟通→试点→收集反馈→迭代→全面推广', w: 25 },
      { id: 'm5', cat: '资源分配', q: '你部门的预算被砍了30%，但项目目标不变。你会怎么重新分配资源？请给出具体方案。', tips: '优先级排序→砍非核心→提升效率→向上争取', w: 20 },
      { id: 'm6', cat: '招聘决策', q: '面试了两个候选人，一个经验丰富但薪资要求高，一个潜力大但经验不足。你选谁？为什么？', tips: '展现用人逻辑和成本意识', w: 20 },
      { id: 'm7', cat: '向上管理', q: '你的上级做了一个你明显不认同的决策，你会怎么处理？请举一个真实例子。', tips: '展现沟通技巧和政治智慧', w: 25 },
      { id: 'm8', cat: '团队搭建', q: '如果你从零搭建一个10人团队，你会怎么设计岗位结构？先招谁？为什么？', tips: '展现组织设计能力', w: 20 },
      { id: 'm9', cat: '授权管理', q: '你团队里有人总喜欢事事请示，你会怎么培养他的独立性？', tips: '展现辅导和授权能力', w: 20 },
      { id: 'm10', cat: '目标拆解', q: '老板给了你一个年度目标：业绩翻倍。你会怎么把这个目标拆解到每个季度和每个月？', tips: '展现目标分解和执行能力', w: 20 },
      { id: 'm11', cat: '跨部门协调', q: '你需要另一个部门配合你的项目，但对方部门经理不配合。你会怎么推进？', tips: '展现影响力和协调能力', w: 25 },
      { id: 'm12', cat: '团队士气', q: '团队连续加班一个月后，大家士气低落、开始抱怨。你会怎么做来提振士气？', tips: '展现同理心和领导力', w: 20 },
      { id: 'm13', cat: '人才留存', q: '你团队的核心骨干提出了离职，你会怎么挽留？如果挽留失败，你的B计划是什么？', tips: '展现留人意识和继任规划', w: 25 },
      { id: 'm14', cat: '决策失误', q: '说一个你作为管理者做错的决策。当时为什么做这个选择？造成了什么后果？你后来怎么补救的？', tips: '真实+反思+改进', w: 25 },
      { id: 'm15', cat: '管理风格', q: '你的管理风格是什么？你能举一个例子说明你的管理风格在实际中是怎么体现的吗？', tips: '不要说"民主型"这种教科书词，用故事说明', w: 20 },
    ],

    // ══════ 5. 技术与工程 ══════
    technical: [
      { id: 't1', cat: '问题排查', q: '说一个你最近解决的最复杂的技术问题。你是怎么定位问题的？用了什么工具和方法？最终怎么解决的？', tips: '详细描述排查思路，不要只说结果', w: 25 },
      { id: 't2', cat: '技术决策', q: '你在项目中做过最艰难的技术选型是什么？当时有哪几个选项？你为什么选了现在这个？有没有后悔？', tips: '展现决策逻辑和权衡能力', w: 25 },
      { id: 't3', cat: '代码质量', q: '你接手过最烂的代码是什么样的？你是怎么重构的？重构前后有什么变化？', tips: '展现代码审美和重构能力', w: 25 },
      { id: 't4', cat: '性能优化', q: '说一个你做过最有成就感的性能优化。优化前后的数据对比是什么？你是怎么找到瓶颈的？', tips: '数据说话+方法论', w: 25 },
      { id: 't5', cat: '系统设计', q: '如果让你设计一个日活100万的XX系统，你会怎么做？请画出核心架构。', tips: '展现架构思维和trade-off意识', w: 30 },
      { id: 't6', cat: '技术债务', q: '你怎么看待技术债务？你有没有处理过技术债务的经历？你是怎么平衡业务需求和技术债务的？', tips: '展现全局思维', w: 20 },
      { id: 't7', cat: '代码评审', q: '你在Code Review中最常发现的3类问题是什么？你能举一个你通过Code Review避免了线上事故的例子吗？', tips: '展现代码质量和风险意识', w: 20 },
      { id: 't8', cat: '线上故障', q: '说一个你经历过的最严重的线上故障。从发现到恢复用了多久？根因是什么？后来做了什么改进？', tips: '展现应急处理和复盘能力', w: 25 },
      { id: 't9', cat: '技术分享', q: '你最近做的一次技术分享是什么主题？为什么选这个主题？听众的反馈怎么样？', tips: '展现技术热情和分享能力', w: 15 },
      { id: 't10', cat: '新技术评估', q: '你评估过新技术吗？你用什么标准来判断一个新技术是否值得引入？', tips: '展现技术判断力', w: 20 },
      { id: 't11', cat: '测试策略', q: '你怎么设计测试用例？你有没有遇到过测试覆盖了但还是出了bug的情况？', tips: '展现质量意识', w: 20 },
      { id: 't12', cat: '文档习惯', q: '你平时写技术文档吗？你觉得好的技术文档应该包含哪些内容？', tips: '展现工程素养', w: 15 },
      { id: 't13', cat: '开源贡献', q: '你有参与过开源项目吗？或者你日常用哪些开源工具？有没有想过给它们贡献代码？', tips: '展现技术社区参与度', w: 15 },
      { id: 't14', cat: '架构演进', q: '你经历过的系统从单体到微服务的迁移是什么样的？最大的挑战是什么？', tips: '展现架构演进经验', w: 25 },
      { id: 't15', cat: '技术视野', q: '你认为未来3年，你所在的技术领域会发生什么重大变化？你准备好了吗？', tips: '展现技术前瞻性', w: 20 },
    ],

    // ══════ 6. 销售与商务 ══════
    sales: [
      { id: 's1', cat: '拒绝处理', q: '客户连续拒绝你三次，说"我们不需要"。你会怎么继续跟进？请模拟你会发的第四条消息。', tips: '不是死缠烂打，而是换角度提供价值', w: 25 },
      { id: 's2', cat: '价格谈判', q: '客户说"你们的价格比竞品贵30%"，你会怎么回应？请现场模拟这段对话。', tips: '先认同→再挖需求→差异化价值→案例证明', w: 25 },
      { id: 's3', cat: '客户关系', q: '说一个你维护了3年以上的客户关系。你是怎么从第一次接触到变成长期合作伙伴的？', tips: '展现长期主义和信任建立过程', w: 20 },
      { id: 's4', cat: '业绩压力', q: '季度末还差30%的业绩，距离deadline只剩两周。你会怎么冲刺？请给出具体行动计划。', tips: '盘点线索→聚焦大单→激活老客户→团队协作', w: 20 },
      { id: 's5', cat: '大客户谈判', q: '你谈过最大的一笔单子是多少？从第一次接触到签单用了多久？过程中最难的是什么？', tips: '展现大客户销售能力', w: 25 },
      { id: 's6', cat: '竞品分析', q: '你最常遇到的竞品是谁？客户选择竞品而不选你的原因通常是什么？你怎么应对？', tips: '展现竞争意识和应对策略', w: 20 },
      { id: 's7', cat: '需求挖掘', q: '客户说"我再考虑考虑"，你会怎么追问来挖掘真实需求？请模拟这段对话。', tips: '提问技巧+需求分析', w: 20 },
      { id: 's8', cat: '客户流失', q: '一个合作了2年的大客户突然说要终止合作，你会怎么挽回？请模拟你的挽留话术。', tips: '了解原因→解决问题→提供补偿→重建信任', w: 25 },
      { id: 's9', cat: '销售方法论', q: '你用什么销售方法论？SPIN、 challenger、还是其他？能举一个你用方法论成功签单的例子吗？', tips: '展现专业销售能力', w: 20 },
      { id: 's10', cat: '渠道开发', q: '如果让你从零开拓一个新区域市场，你会怎么制定前3个月的计划？', tips: '展现市场开拓能力', w: 20 },
      { id: 's11', cat: '商务礼仪', q: '第一次见客户，你会怎么做来建立好的第一印象？能举一个你因为商务礼仪而拿下单子的例子吗？', tips: '展现商务素养', w: 15 },
      { id: 's12', cat: '回款管理', q: '你有没有遇到过客户签了单但迟迟不付款的情况？你是怎么催款的？', tips: '展现回款能力和沟通技巧', w: 20 },
      { id: 's13', cat: '销售预测', q: '你怎么做销售预测？你有什么方法来提高预测的准确性？', tips: '展现数据驱动的销售管理能力', w: 20 },
      { id: 's14', cat: '客户转介绍', q: '你怎么让老客户愿意给你转介绍？你有没有因为转介绍而签单的成功案例？', tips: '展现口碑经营能力', w: 15 },
      { id: 's15', cat: '销售复盘', q: '你做过最失败的一次销售是什么原因？你从中学到了什么？', tips: '真实+反思+改进', w: 20 },
    ],

    // ══════ 7. 市场与品牌 ══════
    marketing: [
      { id: 'mk1', cat: '品牌定位', q: '如果让你给一个新品牌做定位，你会从哪3个维度来思考？能举一个你做过的品牌定位案例吗？', tips: '展现品牌方法论', w: 25 },
      { id: 'mk2', cat: '营销策划', q: '你策划过的最成功的一次营销活动是什么？从创意到执行到结果，请完整复盘。', tips: '数据+方法论+可复制经验', w: 25 },
      { id: 'mk3', cat: '内容营销', q: '你觉得什么样的内容能真正打动用户？你能举一个你写过的转化率最高的文案吗？', tips: '展现内容洞察力', w: 20 },
      { id: 'mk4', cat: '用户增长', q: '如果给你10万预算做用户增长，你会怎么分配？ROI最高的渠道是什么？', tips: '展现增长思维和数据意识', w: 25 },
      { id: 'mk5', cat: '危机公关', q: '如果品牌突然在社交媒体上被大量负面评论攻击，你会怎么处理？请列出你的应急步骤。', tips: '展现危机处理能力', w: 25 },
      { id: 'mk6', cat: '竞品营销', q: '你研究过竞品的营销策略吗？竞品做得最好的一次营销是什么？你从中学到了什么？', tips: '展现竞争意识和学习能力', w: 20 },
      { id: 'mk7', cat: '预算管理', q: '市场部的预算被砍了一半，但KPI不变。你会怎么重新分配预算？', tips: '展现资源优化能力', w: 20 },
      { id: 'mk8', cat: '效果评估', q: '你怎么评估一次营销活动的效果？你最看重哪些指标？为什么？', tips: '展现数据驱动思维', w: 20 },
      { id: 'mk9', cat: '私域运营', q: '你怎么看待私域流量？你有没有搭建过私域体系？能分享一下你的方法论吗？', tips: '展现私域运营能力', w: 20 },
      { id: 'mk10', cat: 'KOL合作', q: '你和KOL/达人合作过吗？怎么选择合适的KOL？怎么评估合作效果？', tips: '展现合作经验和ROI意识', w: 20 },
      { id: 'mk11', cat: '品牌调性', q: '你觉得一个好品牌最重要的3个要素是什么？你能举一个你觉得做得好的品牌吗？', tips: '展现品牌审美和判断力', w: 15 },
      { id: 'mk12', cat: '活动执行', q: '说一个你在活动中遇到突发状况的经历。当时发生了什么？你是怎么处理的？', tips: '展现应变能力', w: 20 },
      { id: 'mk13', cat: '市场调研', q: '你怎么做市场调研？你用什么工具和方法来了解用户需求？', tips: '展现调研方法论', w: 15 },
      { id: 'mk14', cat: '渠道策略', q: '你怎么判断一个新渠道值不值得投入？你有没有快速试错的经验？', tips: '展现渠道判断力', w: 20 },
      { id: 'mk15', cat: '跨界合作', q: '你有没有策划过跨界合作？怎么找到合适的合作对象？效果怎么样？', tips: '展现创意和资源整合能力', w: 20 },
    ],

    // ══════ 8. 运营与项目管理 ══════
    operations: [
      { id: 'o1', cat: '数据驱动', q: '说一个你通过数据分析发现业务问题并解决的案例。你关注了哪些指标？发现了什么异常？采取了什么行动？', tips: '数据→洞察→行动→结果的完整闭环', w: 25 },
      { id: 'o2', cat: '增长策划', q: '如果让你从0到1搭建一个新渠道的运营体系，你会怎么做？请给出30天行动计划。', tips: '调研→定位→内容→引流→转化→复盘', w: 25 },
      { id: 'o3', cat: '内容运营', q: '你做过最成功的一篇内容是什么？为什么它能火？请从选题、标题、内容结构、发布时间等维度复盘。', tips: '具体数据+可复制的方法论', w: 20 },
      { id: 'o4', cat: '用户运营', q: '用户流失率突然从5%飙升到15%，你会怎么排查原因？请列出你的诊断步骤。', tips: '数据分群→行为分析→定性调研→假设验证→行动', w: 25 },
      { id: 'o5', cat: '项目管理', q: '你管理过最复杂的项目是什么？有多少人参与？遇到了什么困难？你是怎么确保按时交付的？', tips: '展现项目管理能力', w: 25 },
      { id: 'o6', cat: '流程优化', q: '你有没有优化过某个工作流程？优化前是什么样的？优化后有什么变化？', tips: '展现效率意识和方法论', w: 20 },
      { id: 'o7', cat: '活动运营', q: '你策划过的参与人数最多的活动是什么？从策划到执行到复盘，请完整讲一遍。', tips: '展现活动全链路能力', w: 25 },
      { id: 'o8', cat: '社群运营', q: '你搭建过社群吗？怎么提高社群的活跃度和留存率？能分享一个你做得好的社群案例吗？', tips: '展现社群运营能力', w: 20 },
      { id: 'o9', cat: '数据分析', q: '你平时用什么数据分析工具？能举一个你通过数据发现隐藏机会的例子吗？', tips: '展现数据工具使用能力', w: 20 },
      { id: 'o10', cat: '竞品分析', q: '你怎么做竞品分析？你通常从哪些维度来对比竞品？能举一个你通过竞品分析找到差异化机会的例子吗？', tips: '展现分析框架', w: 20 },
      { id: 'o11', cat: '用户调研', q: '你怎么了解用户的真实需求？你用过哪些用户调研方法？哪种最有效？', tips: '展现用户研究能力', w: 20 },
      { id: 'o12', cat: 'SOP搭建', q: '你有没有搭建过SOP（标准操作流程）？你是怎么让团队遵守SOP的？', tips: '展现标准化能力', w: 20 },
      { id: 'o13', cat: '资源协调', q: '你需要多个部门配合完成一个项目，但各部门优先级不同。你怎么协调？', tips: '展现跨部门协调能力', w: 25 },
      { id: 'o14', cat: '异常处理', q: '运营数据突然异常（比如转化率暴跌），你的第一反应是什么？你会怎么排查？', tips: '展现应急处理能力', w: 20 },
      { id: 'o15', cat: '效率工具', q: '你日常用什么工具来提升工作效率？能推荐3个你觉得最好用的工具吗？', tips: '展现工具意识和效率思维', w: 15 },
    ],

    // ══════ 9. 客户服务与支持 ══════
    customer_service: [
      { id: 'cs1', cat: '投诉处理', q: '遇到情绪激动的客户投诉，你会怎么处理？请举一个你处理过的最棘手的投诉案例。', tips: '先共情→再解决→后跟进', w: 25 },
      { id: 'cs2', cat: '客户满意度', q: '你怎么衡量客户满意度？你有没有因为客户满意度提升而带来业务增长的案例？', tips: '展现服务意识和数据思维', w: 20 },
      { id: 'cs3', cat: '重复性工作', q: '这个岗位可能需要重复性的工作，你能接受吗？你有什么方法保持效率和质量？', tips: '表达耐心和责任心', w: 15 },
      { id: 'cs4', cat: '服务流程', q: '你有没有优化过客户服务流程？优化前后客户体验有什么变化？', tips: '展现流程优化能力', w: 20 },
      { id: 'cs5', cat: '客户挽回', q: '一个流失了半年的客户突然回来投诉，你会怎么处理？怎么让他重新信任你们？', tips: '展现挽回能力和服务意识', w: 25 },
      { id: 'cs6', cat: '服务标准', q: '你觉得一个好的客户服务团队应该具备哪些标准？你能举一个你建立服务标准的例子吗？', tips: '展现服务体系建设能力', w: 20 },
      { id: 'cs7', cat: '团队培训', q: '你怎么培训新入职的客服人员？你有一套自己的培训方法吗？', tips: '展现培训和带教能力', w: 20 },
      { id: 'cs8', cat: '情绪管理', q: '遇到无理取闹的客户，你怎么控制自己的情绪？能举一个你差点失控但最终处理好了的例子吗？', tips: '展现情绪管理能力', w: 20 },
      { id: 'cs9', cat: '服务创新', q: '你有没有做过超出常规服务范围的事情来让客户惊喜？效果怎么样？', tips: '展现服务创新意识', w: 20 },
      { id: 'cs10', cat: '客诉升级', q: '一线客服处理不了的投诉升级到你这里，你的处理步骤是什么？', tips: '展现升级处理能力', w: 20 },
      { id: 'cs11', cat: '服务成本', q: '你怎么在保证服务质量的同时控制服务成本？能举一个具体的例子吗？', tips: '展现成本意识', w: 20 },
      { id: 'cs12', cat: 'NPS管理', q: '你了解NPS（净推荐值）吗？你有没有通过改善NPS带来实际业务增长的案例？', tips: '展现客户洞察力', w: 20 },
      { id: 'cs13', cat: 'VIP服务', q: '你怎么定义VIP客户？VIP客户和普通客户的服务差异在哪里？', tips: '展现分层服务思维', w: 15 },
      { id: 'cs14', cat: '服务话术', q: '你能分享3句你在服务中常用的有效话术吗？为什么这些话术有效？', tips: '展现沟通技巧', w: 15 },
      { id: 'cs15', cat: '客户流失预警', q: '你怎么提前发现客户可能要流失？你有什么预警机制？', tips: '展现主动服务意识', w: 20 },
    ],

    // ══════ 10. 财务与审计 ══════
    finance: [
      { id: 'f1', cat: '财务分析', q: '你怎么分析一家公司的财务健康状况？你会看哪些核心指标？能举一个你通过财务分析发现问题的例子吗？', tips: '展现财务分析能力', w: 25 },
      { id: 'f2', cat: '成本控制', q: '你做过最成功的成本控制项目是什么？节省了多少？你是怎么找到降本空间的？', tips: '数据说话+方法论', w: 25 },
      { id: 'f3', cat: '预算管理', q: '你怎么制定和执行部门预算？有没有遇到过预算超支的情况？你怎么处理的？', tips: '展现预算管理能力', w: 20 },
      { id: 'f4', cat: '税务筹划', q: '你有没有做过税务筹划？能举一个你通过合法筹划帮公司节省税费的例子吗？', tips: '展现税务专业能力', w: 25 },
      { id: 'f5', cat: '内控建设', q: '你搭建过公司的内控体系吗？你觉得中小企业最容易出现的财务风险是什么？', tips: '展现风控意识', w: 25 },
      { id: 'f6', cat: '审计发现', q: '你在审计中发现过的最严重的问题是什么？你是怎么处理的？', tips: '展现审计敏感度', w: 20 },
      { id: 'f7', cat: '财务软件', q: '你熟练使用哪些财务软件？如果你需要快速上手一个新系统，你会怎么做？', tips: '展现学习能力', w: 15 },
      { id: 'f8', cat: '报表编制', q: '你编制过最复杂的财务报表是什么？遇到了什么挑战？', tips: '展现专业能力', w: 20 },
      { id: 'f9', cat: '资金管理', q: '你怎么管理公司的现金流？有没有遇到过资金紧张的情况？你是怎么应对的？', tips: '展现资金管理能力', w: 20 },
      { id: 'f10', cat: '合规经验', q: '你经历过哪些财务合规审查？有没有因为合规问题导致的麻烦？你怎么解决的？', tips: '展现合规意识', w: 20 },
      { id: 'f11', cat: '财务谈判', q: '你需要和银行谈判贷款条件，你会怎么准备？能举一个你成功谈判的例子吗？', tips: '展现谈判能力', w: 20 },
      { id: 'f12', cat: '数据可视化', q: '你怎么向非财务部门的同事解释财务数据？你用什么工具做财务报表可视化？', tips: '展现沟通和工具能力', w: 15 },
      { id: 'f13', cat: '风险管理', q: '你怎么识别和管理企业的财务风险？能举一个你成功规避财务风险的例子吗？', tips: '展现风险意识', w: 20 },
      { id: 'f14', cat: '业财融合', q: '你怎么理解"业财融合"？你有没有做过业务和财务结合的项目？', tips: '展现业财融合思维', w: 20 },
      { id: 'f15', cat: '职业判断', q: '你有没有遇到过准则没有明确规定的会计处理问题？你是怎么做职业判断的？', tips: '展现专业判断力', w: 20 },
    ],

    // ══════ 11. 人力资源与行政 ══════
    hr_admin: [
      { id: 'hr1', cat: '招聘实操', q: '你怎么判断一个候选人是否真的适合这个岗位？你用什么面试方法？', tips: '展现招聘专业度', w: 25 },
      { id: 'hr2', cat: '薪酬设计', q: '你怎么设计一个有竞争力的薪酬体系？你需要考虑哪些因素？', tips: '展现薪酬设计能力', w: 25 },
      { id: 'hr3', cat: '绩效管理', q: '你怎么设计和推行绩效考核制度？有没有遇到过员工抵触的情况？你怎么处理的？', tips: '展现绩效管理能力', w: 25 },
      { id: 'hr4', cat: '员工关系', q: '你处理过最棘手的员工关系问题是什么？你是怎么解决的？', tips: '展现员工关系处理能力', w: 25 },
      { id: 'hr5', cat: '培训体系', q: '你搭建过企业培训体系吗？你觉得培训效果怎么衡量？', tips: '展现培训体系建设能力', w: 20 },
      { id: 'hr6', cat: '劳动法务', q: '你怎么处理劳动纠纷？能举一个你成功处理的案例吗？', tips: '展现劳动法务能力', w: 25 },
      { id: 'hr7', cat: '组织发展', q: '你怎么理解组织发展？你有没有做过组织诊断和变革的项目？', tips: '展现组织发展视野', w: 20 },
      { id: 'hr8', cat: '企业文化', q: '你怎么建设企业文化？你觉得企业文化最重要的3个要素是什么？', tips: '展现文化建设能力', w: 20 },
      { id: 'hr9', cat: '人才盘点', q: '你做过人才盘点吗？你怎么识别高潜力人才？', tips: '展现人才管理能力', w: 20 },
      { id: 'hr10', cat: '员工离职', q: '一个核心员工突然提离职，你会怎么挽留？如果挽留失败，你会怎么做？', tips: '展现留人意识', w: 20 },
      { id: 'hr11', cat: '行政管理', q: '你怎么管理行政部门的日常运营？你用什么工具来提高行政效率？', tips: '展现行政管理能力', w: 15 },
      { id: 'hr12', cat: '雇主品牌', q: '你怎么提升公司的雇主品牌？你做过哪些吸引人才的事情？', tips: '展现雇主品牌意识', w: 20 },
      { id: 'hr13', cat: '人力规划', q: '你怎么做年度人力规划？你需要考虑哪些因素？', tips: '展现人力资源规划能力', w: 20 },
      { id: 'hr14', cat: '面试技巧', q: '你面试过最多的一个岗位是什么？你总结出了什么面试经验？', tips: '展现面试专业度', w: 15 },
      { id: 'hr15', cat: 'HR数字化', q: '你怎么推动HR数字化？你用过哪些HR系统？效果怎么样？', tips: '展现数字化能力', w: 20 },
    ],

    // ══════ 12. 设计与创意 ══════
    design: [
      { id: 'd1', cat: '设计理念', q: '你怎么描述你的设计理念？你能举一个最能代表你设计理念的作品吗？', tips: '展现设计思考深度', w: 20 },
      { id: 'd2', cat: '设计流程', q: '你的设计流程是什么样的？从接到需求到最终交付，你会经历哪些步骤？', tips: '展现专业流程', w: 20 },
      { id: 'd3', cat: '用户研究', q: '你怎么了解用户的设计需求？你用过哪些用户研究方法？', tips: '展现用户研究能力', w: 20 },
      { id: 'd4', cat: '设计评审', q: '你怎么面对设计评审中的负面反馈？能举一个你因为评审反馈而大幅修改设计的例子吗？', tips: '展现接受反馈和迭代能力', w: 20 },
      { id: 'd5', cat: '设计系统', q: '你搭建过设计系统吗？你觉得一个完整的设计系统应该包含哪些内容？', tips: '展现系统化设计能力', w: 25 },
      { id: 'd6', cat: '跨部门协作', q: '设计师和产品经理意见不一致时，你怎么处理？能举一个具体例子吗？', tips: '展现协作能力', w: 20 },
      { id: 'd7', cat: '设计工具', q: '你最常用的3个设计工具是什么？你觉得它们各自的优缺点是什么？', tips: '展现工具专业度', w: 15 },
      { id: 'd8', cat: '品牌设计', q: '你怎么为一个新品牌做视觉设计？你需要了解哪些信息？', tips: '展现品牌设计能力', w: 20 },
      { id: 'd9', cat: '设计趋势', q: '你觉得今年最值得关注的设计趋势是什么？你怎么把趋势应用到实际工作中？', tips: '展现设计敏锐度', w: 15 },
      { id: 'd10', cat: '作品集', q: '你的作品集中最满意的一个项目是什么？从创意到执行的过程是怎样的？', tips: '展现完整项目经历', w: 20 },
      { id: 'd11', cat: '设计效率', q: '你怎么提高设计效率？你有没有做过设计自动化或组件化的工作？', tips: '展现效率意识', w: 20 },
      { id: 'd12', cat: 'A/B测试', q: '你做过设计A/B测试吗？测试结果和你的预期一致吗？', tips: '展现数据驱动设计能力', w: 20 },
      { id: 'd13', cat: '设计决策', q: '你怎么向非设计背景的领导解释你的设计决策？', tips: '展现沟通和翻译能力', w: 15 },
      { id: 'd14', cat: '竞品设计', q: '你研究过竞品的设计吗？竞品做得最好的设计是什么？你从中学到了什么？', tips: '展现设计分析能力', w: 15 },
      { id: 'd15', cat: '设计成长', q: '你怎么持续提升自己的设计能力？你关注哪些设计资源？', tips: '展现学习热情', w: 15 },
    ],

    // ══════ 13. 数据与分析 ══════
    data_analytics: [
      { id: 'da1', cat: '数据故事', q: '你怎么用数据讲一个有说服力的故事？能举一个你通过数据汇报影响决策的例子吗？', tips: '展现数据叙事能力', w: 25 },
      { id: 'da2', cat: '指标体系', q: '你怎么搭建一个业务的指标体系？你会从哪些维度来拆解核心指标？', tips: '展现指标设计能力', w: 25 },
      { id: 'da3', cat: '异常分析', q: '业务数据突然出现异常波动，你的排查思路是什么？能举一个你定位到根因的例子吗？', tips: '展现分析思路', w: 25 },
      { id: 'da4', cat: '数据工具', q: '你最擅长的3个数据分析工具是什么？能举一个你用这些工具解决实际问题的例子吗？', tips: '展现工具能力', w: 20 },
      { id: 'da5', cat: '预测模型', q: '你搭建过预测模型吗？模型的准确率怎么样？你是怎么优化的？', tips: '展现建模能力', w: 25 },
      { id: 'da6', cat: '数据治理', q: '你怎么保证数据质量？你有没有做过数据清洗和数据治理的工作？', tips: '展现数据治理意识', w: 20 },
      { id: 'da7', cat: 'SQL能力', q: '你能写一个多表关联的复杂SQL查询吗？能举一个你通过SQL分析业务的例子吗？', tips: '展现SQL能力', w: 20 },
      { id: 'da8', cat: '可视化', q: '你怎么选择合适的图表类型来展示数据？能举一个你做过的最好的数据可视化案例吗？', tips: '展现可视化能力', w: 20 },
      { id: 'da9', cat: '业务理解', q: '你怎么理解"数据要服务于业务"？能举一个你通过数据分析驱动业务增长的例子吗？', tips: '展现业务理解力', w: 25 },
      { id: 'da10', cat: '实验设计', q: '你设计过A/B实验吗？你怎么确定样本量和实验周期？', tips: '展现实验设计能力', w: 20 },
      { id: 'da11', cat: '数据报告', q: '你觉得一份好的数据分析报告应该包含哪些内容？你怎么让报告更有说服力？', tips: '展现报告能力', w: 15 },
      { id: 'da12', cat: '数据平台', q: '你用过哪些数据平台（如神策、GrowingIO、Tableau等）？你觉得它们各自的优势是什么？', tips: '展现工具视野', w: 15 },
      { id: 'da13', cat: '数据安全', q: '你怎么处理敏感数据？你了解哪些数据安全的最佳实践？', tips: '展现安全意识', w: 15 },
      { id: 'da14', cat: '实时数据', q: '你有没有处理过实时数据的经验？实时数据和离线数据有什么区别？', tips: '展现技术视野', w: 20 },
      { id: 'da15', cat: '数据驱动', q: '你怎么推动团队用数据做决策？有没有遇到过数据和直觉冲突的情况？你怎么处理的？', tips: '展现数据文化推动能力', w: 20 },
    ],

    // ══════ 14. 教育与培训 ══════
    education: [
      { id: 'e1', cat: '课程设计', q: '你设计过最成功的一门课程是什么？从需求调研到课程上线，你的完整流程是什么？', tips: '展现课程设计能力', w: 25 },
      { id: 'e2', cat: '教学方法', q: '你怎么让学员在课堂上保持专注和参与？你用过哪些互动教学方法？', tips: '展现教学能力', w: 20 },
      { id: 'e3', cat: '学员评估', q: '你怎么评估教学效果？你觉得考试成绩能真实反映学习成果吗？', tips: '展现评估能力', w: 20 },
      { id: 'e4', cat: '教学难点', q: '你教过的最难理解的知识点是什么？你是怎么让学员理解的？', tips: '展现教学技巧', w: 20 },
      { id: 'e5', cat: '因材施教', q: '同一个班里学员水平参差不齐，你怎么兼顾不同水平的学员？', tips: '展现差异化教学能力', w: 20 },
      { id: 'e6', cat: '线上教学', q: '你怎么设计线上课程？线上教学和线下教学最大的区别是什么？', tips: '展现线上教学能力', w: 20 },
      { id: 'e7', cat: '学员反馈', q: '你怎么处理学员的负面反馈？能举一个你因为学员反馈而改进课程的例子吗？', tips: '展现反馈处理能力', w: 20 },
      { id: 'e8', cat: '课程推广', q: '你怎么推广一门新课程？你用过哪些招生渠道？效果怎么样？', tips: '展现课程推广能力', w: 20 },
      { id: 'e9', cat: '教育科技', q: '你用过哪些教育科技工具（如LMS、互动工具等）？你觉得AI会怎么改变教育？', tips: '展现教育科技视野', w: 15 },
      { id: 'e10', cat: '职业培训', q: '你怎么设计针对成人学员的职业培训课程？成人学习和儿童学习有什么区别？', tips: '展现成人教育理解', w: 20 },
      { id: 'e11', cat: '教学案例', q: '你能分享一个你教学中的成功案例吗？学员的转变是什么样的？', tips: '展现教学成果', w: 20 },
      { id: 'e12', cat: '课程迭代', q: '你怎么持续改进一门已上线的课程？你用什么数据来判断需要改进？', tips: '展现迭代能力', w: 20 },
      { id: 'e13', cat: '团队教学', q: '你和团队合作开发过课程吗？怎么保证多人协作的课程质量一致？', tips: '展现协作能力', w: 15 },
      { id: 'e14', cat: '教学热情', q: '是什么让你坚持做教育？你从教学中获得的最大成就感是什么？', tips: '展现教育热情', w: 15 },
      { id: 'e15', cat: '行业洞察', q: '你觉得当前教育行业最大的痛点是什么？你有什么解决方案的想法？', tips: '展现行业思考', w: 20 },
    ],

    // ══════ 15. 医疗健康 ══════
    healthcare: [
      { id: 'hc1', cat: '患者沟通', q: '你怎么和患者/客户沟通坏消息？能举一个你处理过的最难的沟通案例吗？', tips: '展现同理心和沟通能力', w: 25 },
      { id: 'hc2', cat: '专业判断', q: '你有没有遇到过需要紧急做专业判断的情况？当时你是怎么处理的？', tips: '展现专业判断力', w: 25 },
      { id: 'hc3', cat: '团队协作', q: '医疗工作需要多学科协作，你有没有协调过多个团队的经历？你是怎么确保协作顺畅的？', tips: '展现协作能力', w: 20 },
      { id: 'hc4', cat: '持续学习', q: '医疗知识更新很快，你怎么保持专业知识的更新？你最近学了什么新知识？', tips: '展现学习能力', w: 20 },
      { id: 'hc5', cat: '情绪管理', q: '面对生死离别的场景，你怎么管理自己的情绪？你怎么避免职业倦怠？', tips: '展现情绪管理能力', w: 25 },
      { id: 'hc6', cat: '医疗合规', q: '你怎么确保自己的工作符合医疗法规和伦理要求？能举一个你处理合规问题的例子吗？', tips: '展现合规意识', w: 20 },
      { id: 'hc7', cat: '健康管理', q: '你怎么管理慢性病患者或长期客户的健康？你用什么方法来提高依从性？', tips: '展现健康管理能力', w: 20 },
      { id: 'hc8', cat: '新技术应用', q: '你有没有应用过新的医疗技术或方法？效果怎么样？', tips: '展现创新意识', w: 20 },
      { id: 'hc9', cat: '医患关系', q: '你怎么维护良好的医患关系？你有没有处理过医患纠纷？', tips: '展现关系管理能力', w: 20 },
      { id: 'hc10', cat: '健康教育', q: '你怎么给患者做健康教育？你觉得健康教育最重要的3个要素是什么？', tips: '展现健康教育能力', w: 15 },
      { id: 'hc11', cat: '应急处理', q: '你遇到过最紧急的医疗情况是什么？你是怎么处理的？', tips: '展现应急处理能力', w: 25 },
      { id: 'hc12', cat: '数据记录', q: '你怎么保证医疗记录的准确性和完整性？你用什么系统来管理数据？', tips: '展现数据管理能力', w: 15 },
      { id: 'hc13', cat: '团队管理', q: '你怎么管理医疗团队的日常工作？你怎么确保服务质量的一致性？', tips: '展现管理能力', w: 20 },
      { id: 'hc14', cat: '成本控制', q: '你怎么在保证医疗质量的同时控制成本？能举一个具体的例子吗？', tips: '展现成本意识', w: 20 },
      { id: 'hc15', cat: '行业趋势', q: '你觉得未来5年医疗健康行业会发生什么重大变化？你准备好了吗？', tips: '展现行业视野', w: 15 },
    ],

    // ══════ 16. 法务与合规 ══════
    legal: [
      { id: 'l1', cat: '合同审查', q: '你审查过最复杂的合同是什么？你发现了什么风险点？你是怎么修改的？', tips: '展现合同审查能力', w: 25 },
      { id: 'l2', cat: '合规建设', q: '你怎么为公司搭建合规体系？你觉得中小企业最容易忽视的合规风险是什么？', tips: '展现合规建设能力', w: 25 },
      { id: 'l3', cat: '纠纷处理', q: '你处理过最棘手的法律纠纷是什么？你是怎么解决的？', tips: '展现纠纷处理能力', w: 25 },
      { id: 'l4', cat: '知识产权', q: '你怎么保护公司的知识产权？你有没有处理过知识产权侵权的案例？', tips: '展现知识产权保护能力', w: 20 },
      { id: 'l5', cat: '法律研究', q: '你怎么进行法律研究？你用什么工具和方法来查找法律依据？', tips: '展现研究能力', w: 20 },
      { id: 'l6', cat: '风险评估', q: '你怎么评估一个业务决策的法律风险？能举一个你因为法律风险而建议放弃项目的例子吗？', tips: '展现风险评估能力', w: 25 },
      { id: 'l7', cat: '法律咨询', q: '你怎么向非法律背景的同事解释法律问题？你能举一个你成功说服业务部门接受法律建议的例子吗？', tips: '展现沟通和翻译能力', w: 20 },
      { id: 'l8', cat: '隐私保护', q: '你怎么确保公司的数据处理符合隐私保护法规（如GDPR、个保法）？', tips: '展现隐私保护能力', w: 20 },
      { id: 'l9', cat: '诉讼管理', q: '你管理过诉讼案件吗？你怎么选择律师和控制诉讼成本？', tips: '展现诉讼管理能力', w: 20 },
      { id: 'l10', cat: '法律培训', q: '你怎么给业务部门做法律培训？你觉得什么样的培训最有效？', tips: '展现培训能力', w: 15 },
      { id: 'l11', cat: '行业法规', q: '你所在行业有哪些特殊的法规要求？你怎么确保公司持续合规？', tips: '展现行业法规了解', w: 20 },
      { id: 'l12', cat: '尽职调查', q: '你参与过尽职调查吗？你在尽职调查中最关注什么？', tips: '展现尽调能力', w: 20 },
      { id: 'l13', cat: '法律科技', q: '你用过哪些法律科技工具？你觉得AI会怎么改变法律行业？', tips: '展现法律科技视野', w: 15 },
      { id: 'l14', cat: '谈判能力', q: '你怎么在商务谈判中维护公司的法律利益？能举一个你成功的谈判案例吗？', tips: '展现谈判能力', w: 20 },
      { id: 'l15', cat: '职业道德', q: '你有没有遇到过职业道德和商业利益冲突的情况？你是怎么处理的？', tips: '展现职业道德意识', w: 20 },
    ],

    // ══════ 17. 远程与灵活办公 ══════
    remote_work: [
      { id: 'rw1', cat: '远程协作', q: '你有远程办公的经验吗？你怎么保证远程工作效率？你用什么工具来协作？', tips: '展现远程工作能力', w: 20 },
      { id: 'rw2', cat: '时间管理', q: '远程办公时你怎么管理自己的时间？你有没有一套自己的时间管理方法？', tips: '展现自律能力', w: 20 },
      { id: 'rw3', cat: '沟通效率', q: '远程办公时沟通效率下降了，你怎么解决这个问题？', tips: '展现沟通能力', w: 20 },
      { id: 'rw4', cat: '团队融入', q: '新加入一个远程团队，你怎么快速融入？你能举一个你成功融入远程团队的例子吗？', tips: '展现融入能力', w: 20 },
      { id: 'rw5', cat: '工作边界', q: '远程办公时你怎么平衡工作和生活？你怎么避免工作侵蚀生活时间？', tips: '展现边界管理能力', w: 20 },
      { id: 'rw6', cat: '远程管理', q: '你怎么远程管理团队？你怎么保证远程团队的执行力？', tips: '展现远程管理能力', w: 25 },
      { id: 'rw7', cat: '异步沟通', q: '你怎么理解和实践异步沟通？你用什么工具来实现异步协作？', tips: '展现异步沟通能力', w: 20 },
      { id: 'rw8', cat: '远程面试', q: '你远程面试过别人吗？远程面试和现场面试有什么区别？你怎么判断候选人？', tips: '展现远程面试能力', w: 15 },
      { id: 'rw9', cat: '自律能力', q: '远程办公时你是怎么保持专注的？你有没有遇到过注意力分散的问题？怎么解决的？', tips: '展现自律能力', w: 15 },
      { id: 'rw10', cat: '工具推荐', q: '你推荐哪些远程办公工具？你日常用什么工具来管理远程工作？', tips: '展现工具使用经验', w: 15 },
      { id: 'rw11', cat: '远程文化', q: '你怎么在远程团队中建立团队文化？你觉得远程团队文化最重要的是什么？', tips: '展现文化建设能力', w: 20 },
      { id: 'rw12', cat: '跨时区', q: '你有和不同时区的团队合作的经验吗？你怎么处理时差问题？', tips: '展现跨时区协作能力', w: 15 },
      { id: 'rw13', cat: '远程培训', q: '你怎么远程培训新员工？你觉得远程培训最大的挑战是什么？', tips: '展现远程培训能力', w: 20 },
      { id: 'rw14', cat: '远程决策', q: '远程团队怎么做决策？你怎么保证决策的效率和质量？', tips: '展现决策能力', w: 20 },
      { id: 'rw15', cat: '混合办公', q: '你怎么看待混合办公模式？你觉得混合办公最大的挑战是什么？', tips: '展现混合办公思考', w: 15 },
    ],

    // ══════ 18. 创业与自由职业 ══════
    entrepreneurship: [
      { id: 'en1', cat: '创业经历', q: '你有过创业经历吗？你学到了什么？如果再来一次，你会做哪些不同的决定？', tips: '展现创业反思', w: 25 },
      { id: 'en2', cat: '商业思维', q: '你怎么理解商业模式？你能画一个你熟悉的商业模式画布吗？', tips: '展现商业思维', w: 25 },
      { id: 'en3', cat: 'MVP验证', q: '你怎么验证一个商业想法？你有没有快速MVP的经验？', tips: '展现验证能力', w: 20 },
      { id: 'en4', cat: '融资经验', q: '你有融资经验吗？你怎么准备BP？你觉得投资人最看重什么？', tips: '展现融资能力', w: 25 },
      { id: 'en5', cat: '客户获取', q: '如果从零开始获取前100个客户，你会怎么做？', tips: '展现获客能力', w: 20 },
      { id: 'en6', cat: '成本控制', q: '创业初期你怎么控制成本？你做过最聪明的成本优化是什么？', tips: '展现成本意识', w: 20 },
      { id: 'en7', cat: '团队搭建', q: '创业公司怎么吸引和留住人才？你觉得创业团队最重要的3个特质是什么？', tips: '展现团队搭建能力', w: 20 },
      { id: 'en8', cat: '失败经验', q: '你经历过创业失败吗？你是怎么走出来的？你从中学到了什么？', tips: '展现韧性和学习能力', w: 25 },
      { id: 'en9', cat: '产品思维', q: '你怎么理解产品思维？你有没有把一个想法变成产品经验？', tips: '展现产品思维', w: 20 },
      { id: 'en10', cat: '自由职业', q: '你有自由职业的经验吗？你觉得自由职业最大的挑战是什么？你怎么管理自己？', tips: '展现自由职业能力', w: 20 },
      { id: 'en11', cat: '副业规划', q: '你有没有做过副业？你怎么平衡主业和副业？', tips: '展现规划能力', w: 15 },
      { id: 'en12', cat: '资源整合', q: '创业过程中你怎么整合资源？你能举一个你通过资源整合解决难题的例子吗？', tips: '展现资源整合能力', w: 20 },
      { id: 'en13', cat: '市场验证', q: '你怎么判断一个市场值不值得进入？你用什么方法做市场验证？', tips: '展现市场判断力', w: 20 },
      { id: 'en14', cat: '竞争策略', q: '如果你的竞争对手是一个大公司，你会怎么竞争？', tips: '展现竞争策略思维', w: 20 },
      { id: 'en15', cat: '创业心态', q: '创业过程中最让你焦虑的是什么？你是怎么调整心态的？', tips: '展现心态管理能力', w: 15 },
    ],

    // ══════ 19. 转行与职业转型 ══════
    career_change: [
      { id: 'cc1', cat: '转行动机', q: '你为什么想转行？是什么让你决定离开现在的领域？', tips: '展现理性决策', w: 20 },
      { id: 'cc2', cat: '技能迁移', q: '你之前的哪些技能可以迁移到新领域？你是怎么发现这些技能的？', tips: '展现技能迁移能力', w: 25 },
      { id: 'cc3', cat: '差距分析', q: '你觉得转行最大的挑战是什么？你和目标岗位之间的差距在哪里？', tips: '展现自我认知', w: 20 },
      { id: 'cc4', cat: '准备计划', q: '你为转行做了哪些准备？你有什么具体的行动计划？', tips: '展现准备充分', w: 20 },
      { id: 'cc5', cat: '行业认知', q: '你对新行业了解多少？你是怎么了解这个行业的？', tips: '展现行业研究能力', w: 20 },
      { id: 'cc6', cat: '降薪接受', q: '转行可能需要接受降薪，你能接受吗？你的底线是什么？', tips: '展现务实心态', w: 15 },
      { id: 'cc7', cat: '经验转化', q: '你之前的工作经验和新岗位之间，有哪些可以直接复用的能力？你怎么在面试中证明这些能力？', tips: '展现技能迁移的实证能力', w: 20 },
      { id: 'cc8', cat: '人脉利用', q: '你在转行过程中有没有利用过人脉？你是怎么获得新行业信息的？', tips: '展现人脉利用能力', w: 15 },
      { id: 'cc9', cat: '学习曲线', q: '新领域的学习曲线陡峭吗？你是怎么加速学习的？', tips: '展现学习能力', w: 20 },
      { id: 'cc10', cat: '面试策略', q: '转行面试时你怎么说服面试官你适合这个岗位？你有什么独特的策略？', tips: '展现面试策略', w: 20 },
      { id: 'cc11', cat: '风险评估', q: '你觉得转行最大的风险是什么？你做了什么来降低风险？', tips: '展现风险意识', w: 20 },
      { id: 'cc12', cat: '成功案例', q: '你认识成功转行的人吗？他们是怎么做到的？你从中学到了什么？', tips: '展现研究能力', w: 15 },
      { id: 'cc13', cat: '心理准备', q: '转行后可能要从初级岗位做起，你能接受吗？你怎么调整心态？', tips: '展现心理准备', w: 15 },
      { id: 'cc14', cat: '长期规划', q: '转行后你的3年职业规划是什么？你觉得新领域最有发展潜力的方向是什么？', tips: '展现长期规划能力', w: 20 },
      { id: 'cc15', cat: '转行后悔', q: '你有没有犹豫过要不要转行？是什么让你最终下定决心的？', tips: '展现决策过程', w: 15 },
    ],

    // ══════ 20. 压力与情绪管理 ══════
    pressure: [
      { id: 'p1', cat: '高压环境', q: '说一个你在高压环境下工作的经历。当时的情况是什么？你是怎么保持冷静的？', tips: '展现压力管理能力', w: 25 },
      { id: 'p2', cat: '情绪失控', q: '你有没有在工作中情绪失控过？当时发生了什么？你是怎么恢复的？', tips: '真实+反思+改进', w: 25 },
      { id: 'p3', cat: '挫折经历', q: '说一个你职业生涯中最大的挫折。你是怎么度过的？从中学到了什么？', tips: '展现韧性和成长', w: 25 },
      { id: 'p4', cat: '压力应对', q: '说一个你同时面对多个紧急项目、压力很大的经历。你是怎么排优先级、确保按时交付的？', tips: '展现时间管理和压力下的执行力', w: 20 },
      { id: 'p5', cat: '加班文化', q: '你怎么看待加班？你有没有因为加班而影响生活质量？你是怎么处理的？', tips: '展现理性态度', w: 15 },
      { id: 'p6', cat: '批评接受', q: '你怎么接受批评？能举一个你被严厉批评后如何改进的例子吗？', tips: '展现接受批评的能力', w: 20 },
      { id: 'p7', cat: '工作生活', q: '你怎么平衡工作和生活？你有没有因为工作而牺牲过生活？', tips: '展现平衡能力', w: 15 },
      { id: 'p8', cat: '持续投入', q: '你有没有遇到过一个项目持续很久、感觉看不到终点的情况？你是怎么保持团队的工作节奏和产出质量的？', tips: '展现长期项目管理能力', w: 20 },
      { id: 'p9', cat: '心态调整', q: '遇到不公平的待遇，你怎么调整自己的心态？能举一个具体的例子吗？', tips: '展现心态管理能力', w: 20 },
      { id: 'p10', cat: '竞争压力', q: '你怎么面对同事之间的竞争压力？你能举一个你把竞争转化为动力的例子吗？', tips: '展现竞争心态', w: 15 },
      { id: 'p11', cat: '不确定性', q: '面对工作中的不确定性，你怎么保持专注和效率？', tips: '展现适应能力', w: 20 },
      { id: 'p12', cat: '自我激励', q: '当你对工作失去动力时，你怎么重新激励自己？', tips: '展现自驱力', w: 15 },
      { id: 'p13', cat: '失败经历', q: '说一个你在工作中因为判断失误导致项目受挫的经历。你是怎么发现错误、怎么补救的？', tips: '展现纠错能力和复盘意识', w: 15 },
      { id: 'p14', cat: '完美主义', q: '你是一个完美主义者吗？你觉得完美主义在工作中是优势还是劣势？', tips: '展现自我认知', w: 15 },
      { id: 'p15', cat: '节奏调整', q: '高强度工作一段时间后，你怎么调整自己的状态来保持持续输出？你有什么具体方法？', tips: '展现自我调节和持续作战能力', w: 15 },
    ],

    // ══════ 21. 团队协作与沟通 ══════
    teamwork: [
      { id: 'tw1', cat: '协作冲突', q: '你和同事产生过分歧吗？你是怎么解决的？最终结果怎么样？', tips: '展现冲突解决能力', w: 20 },
      { id: 'tw2', cat: '跨部门', q: '你和不熟悉的部门合作过项目吗？你是怎么快速建立信任的？', tips: '展现跨部门协作能力', w: 20 },
      { id: 'tw3', cat: '影响力', q: '你怎么影响没有上下级关系的人？能举一个你说服别人的例子吗？', tips: '展现影响力', w: 25 },
      { id: 'tw4', cat: '团队贡献', q: '在一个团队项目中，你通常扮演什么角色？你能举一个你为团队做出关键贡献的例子吗？', tips: '展现团队价值', w: 20 },
      { id: 'tw5', cat: '沟通风格', q: '你的沟通风格是什么样的？你觉得不同的人需要不同的沟通方式吗？', tips: '展现沟通灵活性', w: 15 },
      { id: 'tw6', cat: '倾听能力', q: '你觉得倾听和表达哪个更重要？你能举一个你通过倾听解决问题的例子吗？', tips: '展现倾听能力', w: 15 },
      { id: 'tw7', cat: '反馈给予', q: '你怎么给同事提反馈意见？你能举一个你通过反馈帮助同事成长的例子吗？', tips: '展现反馈能力', w: 20 },
      { id: 'tw8', cat: '反馈接受', q: '你怎么接受同事给你的反馈？你能举一个你因为同事的反馈而改进的例子吗？', tips: '展现接受反馈的能力', w: 15 },
      { id: 'tw9', cat: '会议效率', q: '你怎么让会议更高效？你有没有优化过会议流程？', tips: '展现效率意识', w: 15 },
      { id: 'tw10', cat: '信息共享', q: '你怎么保证团队成员之间的信息同步？你用什么工具和方法？', tips: '展现信息管理能力', w: 15 },
      { id: 'tw11', cat: '团队建设', q: '你参加过团队建设活动吗？你觉得什么团建活动最有效？', tips: '展现团队意识', w: 15 },
      { id: 'tw12', cat: '信任建立', q: '你怎么在团队中建立信任？你能举一个你通过信任解决难题的例子吗？', tips: '展现信任建设能力', w: 20 },
      { id: 'tw13', cat: '协作工具', q: '你用什么协作工具？你觉得哪个工具对团队效率提升最大？', tips: '展现工具使用能力', w: 15 },
      { id: 'tw14', cat: '虚拟团队', q: '你有在虚拟团队中工作的经验吗？虚拟团队协作最大的挑战是什么？', tips: '展现虚拟协作能力', w: 15 },
      { id: 'tw15', cat: '团队激励', q: '你怎么激励团队成员？你有没有因为你的激励而让团队表现提升的例子？', tips: '展现激励能力', w: 20 },
    ],

    // ══════ 22. 决策与问题解决 ══════
    decision: [
      { id: 'dc1', cat: '决策困难', q: '说一个你做过的最困难的决策。你考虑了哪些因素？最终是怎么决定的？结果如何？', tips: '展现决策过程', w: 25 },
      { id: 'dc2', cat: '信息不足', q: '在信息不完整的情况下，你怎么做决策？能举一个具体的例子吗？', tips: '展现决断力', w: 25 },
      { id: 'dc3', cat: '风险决策', q: '你有没有做过高风险的决策？你是怎么评估和管理风险的？', tips: '展现风险管理能力', w: 25 },
      { id: 'dc4', cat: '创新方案', q: '你怎么找到创新的解决方案？能举一个你用非传统方法解决问题的例子吗？', tips: '展现创新能力', w: 20 },
      { id: 'dc5', cat: '根因分析', q: '你怎么找到问题的根本原因？你用什么分析方法？能举一个你成功找到根因的例子吗？', tips: '展现分析能力', w: 20 },
      { id: 'dc6', cat: '系统思维', q: '你怎么理解系统思维？你能举一个你用系统思维分析问题的例子吗？', tips: '展现系统思维', w: 20 },
      { id: 'dc7', cat: '方案对比', q: '你怎么比较不同的解决方案？你用什么标准来做选择？', tips: '展现方案评估能力', w: 20 },
      { id: 'dc8', cat: '执行力', q: '说一个你快速决策并高效执行的例子。你是怎么做到的？', tips: '展现执行力', w: 20 },
      { id: 'dc9', cat: '纠错能力', q: '你有没有做过错误的决策？你是怎么发现并纠正的？', tips: '展现纠错能力', w: 20 },
      { id: 'dc10', cat: '数据决策', q: '你怎么用数据来支持决策？能举一个你通过数据改变了决策的例子吗？', tips: '展现数据驱动决策能力', w: 20 },
      { id: 'dc11', cat: '直觉决策', q: '你相信直觉吗？你有没有靠直觉做出正确决策的经历？', tips: '展现决策多样性', w: 15 },
      { id: 'dc12', cat: '集体决策', q: '你怎么做集体决策？你怎么处理团队成员意见不一致的情况？', tips: '展现集体决策能力', w: 20 },
      { id: 'dc13', cat: '快速迭代', q: '你怎么在不确定中快速迭代？你有没有"先做再改"的经历？', tips: '展现敏捷思维', w: 20 },
      { id: 'dc14', cat: '优先级', q: '你怎么排定工作的优先级？你用什么框架来帮助决策？', tips: '展现优先级管理能力', w: 15 },
      { id: 'dc15', cat: '决策复盘', q: '你做过决策复盘吗？你通常会从哪些维度来复盘一个决策？', tips: '展现复盘能力', w: 15 },
    ],

    // ══════ 23. 宝妈专属深度题 ══════
    mom_special: [
      { id: 'ms1', cat: '重返职场', q: '你离开职场多久了？这段时间你做了哪些准备来让自己重新适应工作节奏？', tips: '学习/兼职/志愿者/社群运营都算准备', w: 20 },
      { id: 'ms2', cat: '工作家庭', q: '如果项目截止日期和孩子生病撞在一起，你会怎么处理？请说说你的真实想法。', tips: '展现规划能力+应急预案+坦诚态度', w: 25 },
      { id: 'ms3', cat: '妈妈优势', q: '全职带娃这几年，你觉得你获得了哪些职场上用得到的能力？请举具体例子。', tips: '时间管理、多任务处理、情绪管理、谈判都是真实能力', w: 20 },
      { id: 'ms4', cat: '顾虑坦白', q: '你最担心重返职场后遇到什么问题？你打算怎么应对？', tips: '坦诚说出真实顾虑+具体应对方案', w: 20 },
      { id: 'ms5', cat: '职场断层', q: '你离开职场的这段时间，行业发生了哪些变化？你觉得最大的变化是什么？', tips: '展现行业敏感度和学习能力', w: 20 },
      { id: 'ms6', cat: '市场认知', q: '你离开的这几年，你所在行业发生了哪些变化？你做了什么来跟上这些变化？', tips: '展现行业敏感度和主动学习', w: 20 },
      { id: 'ms7', cat: '薪资预期', q: '你对重返职场后的薪资预期是什么？你能接受比离开前低多少？', tips: '展现务实心态', w: 15 },
      { id: 'ms8', cat: '岗位选择', q: '你为什么选择这个岗位？你觉得这个岗位和你的能力匹配吗？', tips: '展现岗位理解', w: 20 },
      { id: 'ms9', cat: '带娃能力', q: '你觉得带娃过程中培养的哪些能力可以在工作中直接用到？请举具体例子。', tips: '具体化每个能力', w: 20 },
      { id: 'ms10', cat: '家庭支持', q: '你的家人支持你重返职场吗？如果孩子需要照顾，你有备用方案吗？', tips: '展现准备充分', w: 15 },
      { id: 'ms11', cat: '职业连续性', q: '你离开前的工作经验和现在想做的工作之间，有什么关联？你怎么让面试官相信你能无缝衔接？', tips: '找到技能迁移点', w: 20 },
      { id: 'ms12', cat: '能力证明', q: '你觉得带娃这几年培养的能力中，哪一项对你的目标岗位帮助最大？请用一个具体场景说明。', tips: '用STAR法则讲清楚能力如何迁移到工作中', w: 15 },
      { id: 'ms13', cat: '精力管理', q: '你怎么管理自己的精力？你怎么保证工作时精力充沛？', tips: '展现精力管理能力', w: 15 },
      { id: 'ms14', cat: '竞争策略', q: '重返职场后，你打算怎么让自己快速进入工作状态？你有什么具体的行动计划？', tips: '展现行动力和目标感', w: 20 },
      { id: 'ms15', cat: '未来规划', q: '重返职场后，你的3年规划是什么？你觉得5年后的自己会是什么样的？', tips: '展现长期规划能力', w: 15 },
    ],
  };

  // ── 智能追问系统 v2.0：多级追问 + 上下文追踪 + 深度挖掘 ──

  // 追问链：每组含多级追问，按顺序触发
  const FOLLOWUP_CHAINS = [
    {
      keywords: /团队|带领|管理|下属|部门/,
      levels: [
        { q: '你当时管理多少人？团队的组织架构是什么样的？', depth: 'detail' },
        { q: '团队里有没有你亲手招进来的人？你是怎么筛选的？', depth: 'expand' },
        { q: '如果团队中有人不服从安排，你会怎么处理？能举一个具体例子吗？', depth: 'challenge' },
        { q: '你团队的离职率怎么样？你是怎么留住核心成员的？', depth: 'deepen' },
      ]
    },
    {
      keywords: /数据|指标|分析|报表|bi|数据化/,
      levels: [
        { q: '你用什么工具做数据分析？Excel、SQL、还是其他？', depth: 'detail' },
        { q: '能举一个你通过数据发现问题并解决的真实案例吗？', depth: 'expand' },
        { q: '如果数据和你的直觉冲突，你信哪个？为什么？', depth: 'challenge' },
        { q: '你怎么保证数据的准确性？你有没有因为数据错误而做过错误决策？', depth: 'deepen' },
      ]
    },
    {
      keywords: /客户|甲方|用户|顾客|学员/,
      levels: [
        { q: '你服务过最多的客户群体是什么样的？', depth: 'detail' },
        { q: '遇到难缠的客户你会怎么处理？能举一个最棘手的例子吗？', depth: 'expand' },
        { q: '你是怎么维护长期客户关系的？有没有合作3年以上的客户？', depth: 'deepen' },
        { q: '你有没有因为服务不好而丢失过客户？后来怎么改进的？', depth: 'challenge' },
      ]
    },
    {
      keywords: /项目|产品|上线|交付|需求/,
      levels: [
        { q: '这个项目你具体负责什么部分？团队有多少人？', depth: 'detail' },
        { q: '遇到了什么困难？你是怎么解决的？', depth: 'expand' },
        { q: '项目延期了你会怎么处理？有没有真实的赶工经历？', depth: 'challenge' },
        { q: '如果让你重新做这个项目，你会在哪些方面做得不一样？', depth: 'deepen' },
      ]
    },
    {
      keywords: /学习|培训|提升|进修|考证/,
      levels: [
        { q: '你最近学的最有用的一个技能是什么？', depth: 'detail' },
        { q: '学了之后对工作有什么具体帮助？能举个例子吗？', depth: 'expand' },
        { q: '你觉得你目前最需要提升的能力是什么？你打算怎么补？', depth: 'deepen' },
        { q: '你有没有学了但没用上的情况？为什么没用上？', depth: 'challenge' },
      ]
    },
    {
      keywords: /困难|挑战|压力|失败|挫折|低谷/,
      levels: [
        { q: '当时的情况具体是什么样的？压力有多大？', depth: 'detail' },
        { q: '你当时是怎么扛过来的？有没有想过放弃？', depth: 'expand' },
        { q: '从这次经历中你学到了什么？后来有没有用到这个教训？', depth: 'deepen' },
        { q: '如果同样的事情再发生一次，你会怎么做？', depth: 'challenge' },
      ]
    },
    {
      keywords: /沟通|协调|合作|协作|谈判/,
      levels: [
        { q: '能举一个你说服别人的例子吗？对方最终同意了吗？', depth: 'detail' },
        { q: '跨部门协作中最难的是什么？你怎么解决的？', depth: 'expand' },
        { q: '你有没有沟通失败的经历？后来怎么补救的？', depth: 'challenge' },
        { q: '你怎么和不同性格的人沟通？你有什么方法论吗？', depth: 'deepen' },
      ]
    },
    {
      keywords: /创意|策划|方案|创新|想法/,
      levels: [
        { q: '这个创意/方案的灵感从哪里来的？', depth: 'detail' },
        { q: '执行效果怎么样？有什么数据支撑吗？', depth: 'expand' },
        { q: '如果让你重新做一次，你会改进什么？', depth: 'challenge' },
        { q: '你有没有创意被否决的经历？你是怎么处理的？', depth: 'deepen' },
      ]
    },
    {
      keywords: /招聘|面试|人才|选拔|用人/,
      levels: [
        { q: '你面试过最多的岗位是什么？你总结出了什么筛选经验？', depth: 'detail' },
        { q: '你怎么判断一个人是否适合公司的文化？', depth: 'expand' },
        { q: '你有没有招错过人？后来怎么处理的？', depth: 'challenge' },
        { q: '你觉得优秀人才最重要的3个特质是什么？', depth: 'deepen' },
      ]
    },
    {
      keywords: /预算|成本|省钱|降本|花销/,
      levels: [
        { q: '你做过最成功的降本项目是什么？节省了多少？', depth: 'detail' },
        { q: '你是怎么找到降本空间的？用了什么方法？', depth: 'expand' },
        { q: '如果预算再砍一半，你还能做什么？', depth: 'challenge' },
        { q: '你怎么平衡降本和质量？有没有因为降本而影响质量的情况？', depth: 'deepen' },
      ]
    },
    {
      keywords: /流程|制度|规范|sop|标准化/,
      levels: [
        { q: '你搭建过什么流程或制度？推行过程中最大的阻力是什么？', depth: 'detail' },
        { q: '你怎么让团队遵守流程？有没有遇到过抵触？', depth: 'expand' },
        { q: '你觉得流程和效率之间怎么平衡？', depth: 'challenge' },
        { q: '你有没有优化过现有流程？优化前后有什么变化？', depth: 'deepen' },
      ]
    },
    {
      keywords: /投诉|纠纷|冲突|矛盾|吵架/,
      levels: [
        { q: '当时的情况具体是什么样的？矛盾的焦点是什么？', depth: 'detail' },
        { q: '你当时的情绪是怎么控制的？', depth: 'expand' },
        { q: '事后有没有复盘？你觉得下次可以怎么做更好？', depth: 'deepen' },
        { q: '如果你是对方，你会怎么看待这件事？', depth: 'challenge' },
      ]
    },
    {
      keywords: /创新|新方法|突破|改革|变革/,
      levels: [
        { q: '这个创新的灵感从哪里来的？', depth: 'detail' },
        { q: '执行过程中遇到了什么阻力？你怎么推动的？', depth: 'expand' },
        { q: '创新失败了你会怎么办？你有失败的创新经历吗？', depth: 'challenge' },
        { q: '你怎么判断一个创新值不值得投入？', depth: 'deepen' },
      ]
    },
    {
      keywords: /销售|签单|业绩|成交|提成|业绩目标/,
      levels: [
        { q: '你签过最大的一笔单是多少？过程是怎样的？', depth: 'detail' },
        { q: '客户说"太贵了"你通常怎么回应？能模拟一下吗？', depth: 'expand' },
        { q: '你有没有跟丢过大单？后来分析原因是什么？', depth: 'challenge' },
        { q: '你的销售方法论是什么？你能总结成一套可复制的方法吗？', depth: 'deepen' },
      ]
    },
    {
      keywords: /运营|增长|转化|引流|获客|留存/,
      levels: [
        { q: '你做过最成功的运营活动是什么？ROI是多少？', depth: 'detail' },
        { q: '你觉得增长最大的瓶颈是什么？你是怎么突破的？', depth: 'expand' },
        { q: '你怎么判断一个运营策略值不值得投入？', depth: 'challenge' },
        { q: '你有没有做过从0到1的增长项目？过程是怎样的？', depth: 'deepen' },
      ]
    },
    {
      keywords: /设计|ui|ux|视觉|界面|交互/,
      levels: [
        { q: '你最满意的一个设计作品是什么？设计思路是怎样的？', depth: 'detail' },
        { q: '你怎么平衡美观和实用？有没有因为领导要求改设计的经历？', depth: 'expand' },
        { q: '你怎么验证你的设计效果？你做过A/B测试吗？', depth: 'challenge' },
        { q: '你觉得好设计和坏设计最大的区别是什么？', depth: 'deepen' },
      ]
    },
    {
      keywords: /远程|居家|灵活|在家办公/,
      levels: [
        { q: '你远程办公时怎么管理自己的时间？', depth: 'detail' },
        { q: '远程办公时沟通效率下降了，你怎么解决？', depth: 'expand' },
        { q: '你怎么避免远程办公时工作侵蚀生活时间？', depth: 'challenge' },
        { q: '你觉得远程办公和现场办公最大的区别是什么？', depth: 'deepen' },
      ]
    },
    {
      keywords: /创业|副业|自由职业|自己做|合伙/,
      levels: [
        { q: '你创业/做副业的初衷是什么？', depth: 'detail' },
        { q: '你学到了什么？如果再来一次，你会做哪些不同的决定？', depth: 'expand' },
        { q: '你有没有经历过失败？你是怎么走出来的？', depth: 'challenge' },
        { q: '你觉得创业和打工最大的区别是什么？', depth: 'deepen' },
      ]
    },
    {
      keywords: /家庭|孩子|带娃|宝妈|育儿|照顾/,
      levels: [
        { q: '你离开职场多久了？这段时间你做了哪些准备？', depth: 'detail' },
        { q: '你觉得带娃过程中培养的哪些能力可以在工作中直接用到？', depth: 'expand' },
        { q: '如果项目截止日期和孩子生病撞在一起，你会怎么处理？', depth: 'challenge' },
        { q: '你的家人支持你重返职场吗？你有备用方案吗？', depth: 'deepen' },
      ]
    },
    {
      keywords: /转行|转型|换行业|换方向|跨领域/,
      levels: [
        { q: '你为什么想转行？是什么让你下定决心的？', depth: 'detail' },
        { q: '你之前的哪些技能可以迁移到新领域？', depth: 'expand' },
        { q: '转行可能需要接受降薪，你能接受吗？', depth: 'challenge' },
        { q: '你为转行做了哪些具体准备？', depth: 'deepen' },
      ]
    },
    {
      keywords: /决策|选择|判断|决定|取舍/,
      levels: [
        { q: '你做过的最困难的决策是什么？', depth: 'detail' },
        { q: '你考虑了哪些因素？最终是怎么决定的？', depth: 'expand' },
        { q: '如果重来一次，你会做同样的决定吗？', depth: 'challenge' },
        { q: '你做决策时更依赖数据还是直觉？', depth: 'deepen' },
      ]
    },
  ];

  // 深度分析：判断回答是否需要追问
  function analyzeDepth(answer, question) {
    const text = (answer || '').trim();
    const len = text.length;
    const result = { needsFollowup: false, reason: '', depth: 0 };

    // 回答太短
    if (len < 30) {
      result.needsFollowup = true;
      result.reason = 'short';
      result.depth = 1;
      return result;
    }

    // 没有具体案例/数据
    const hasCase = /当时|有一次|曾经|之前|在.*公司|具体来说|举个例子|比如|例如/.test(text);
    const hasData = /\d+[%％万元人天次个月年]|提升了?\d+|增长了?\d+|节省了?\d+/.test(text);
    if (!hasCase && !hasData && len < 80) {
      result.needsFollowup = true;
      result.reason = 'no_evidence';
      result.depth = 1;
      return result;
    }

    // 有案例但不够深入
    if (hasCase && !hasData && len < 120) {
      result.needsFollowup = true;
      result.reason = 'shallow_case';
      result.depth = 0.5;
      return result;
    }

    // 回答很好，不需要追问
    result.needsFollowup = false;
    result.depth = 2;
    return result;
  }

  // 生成追问（多级链式）
  function generateFollowups(answer, currentQuestion, session) {
    const text = (answer || '').toLowerCase();
    const followups = [];

    // 1. 检查是否有匹配的追问链
    for (const chain of FOLLOWUP_CHAINS) {
      if (chain.keywords.test(text)) {
        // 找到当前链的进度
        const chainKey = chain.keywords.source;
        const progress = (session.followupProgress || {})[chainKey] || 0;
        if (progress < chain.levels.length) {
          const level = chain.levels[progress];
          followups.push({
            id: 'fu_' + Date.now(),
            cat: '深度追问',
            q: level.q,
            tips: '基于你刚才的回答深入展开',
            w: 15,
            chainKey,
            chainLevel: progress + 1,
          });
        }
        break; // 每轮最多触发一个追问链
      }
    }

    // 2. 如果没有匹配追问链，检查回答深度
    if (followups.length === 0) {
      const depth = analyzeDepth(answer, currentQuestion);
      if (depth.needsFollowup) {
        const depthFollowups = {
          short: [
            '你的回答比较简略，能展开说说吗？请用一个具体的例子来说明。',
            '能再详细一些吗？比如当时的背景是什么？你具体做了什么？',
            '这个回答有点笼统，能给我讲一个真实发生的故事吗？',
          ],
          no_evidence: [
            '你说的这些很好，但能举一个具体的案例来佐证吗？',
            '有没有一个实际的例子能证明你说的这一点？',
            '听起来不错，但我想听一个真实发生的故事，可以吗？',
          ],
          shallow_case: [
            '案例有了，但还不够深入。这个案例最终的结果数据是什么？',
            '你提到了这个案例，那当时遇到的最大阻力是什么？你是怎么克服的？',
            '这个案例的结果很好，但过程中有没有踩过坑？',
          ],
        };
        const pool = depthFollowups[depth.reason] || depthFollowups.short;
        followups.push({
          id: 'fu_' + Date.now(),
          cat: '深度追问',
          q: pool[Math.floor(Math.random() * pool.length)],
          tips: '基于你刚才的回答深入展开',
          w: 15,
        });
      }
    }

    return followups.slice(0, 1); // 每轮最多1个追问
  }

  // 初始化追问进度跟踪
  function initFollowupProgress() {
    return {};
  }

  // 更新追问进度
  function updateFollowupProgress(session, followup) {
    if (followup.chainKey) {
      if (!session.followupProgress) session.followupProgress = {};
      session.followupProgress[followup.chainKey] = followup.chainLevel;
    }
  }

  function initInterviewSession(jobName) {
    const jobTypes = detectJobTypes(jobName);
    const pool = [...INTERVIEW_DB.general];
    for (const t of jobTypes) {
      if (INTERVIEW_DB[t]) pool.push(...INTERVIEW_DB[t]);
    }
    pool.push(...INTERVIEW_DB.mom_special);
    // 去重
    const seen = new Set();
    const unique = pool.filter(q => { if (seen.has(q.id)) return false; seen.add(q.id); return true; });
    for (let i = unique.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [unique[i], unique[j]] = [unique[j], unique[i]];
    }
    return { jobName, jobTypes, pool: unique, asked: [], answers: [], currentQ: 0, round: 0, followups: [], followupProgress: {}, startTime: Date.now() };
  }

  function detectJobTypes(jobName) {
    const n = (jobName || '').toLowerCase();
    const types = [];
    if (/管理|主管|经理|总监|leader|director|vp|ceo|cto|coo/i.test(n)) types.push('management');
    if (/开发|工程|技术|测试|运维|数据|IT| programmer|架构|前端|后端|全栈|算法|人工智能|ai/i.test(n)) types.push('technical');
    if (/销售|商务|客户|bd|渠道|招商|大客户|区域/i.test(n)) types.push('sales');
    if (/市场|品牌|推广|广告|公关|新媒体|营销/i.test(n)) types.push('marketing');
    if (/运营|内容|社群|增长|产品|电商|直播|短视频/i.test(n)) types.push('operations');
    if (/客服|服务|售后|支持|投诉/i.test(n)) types.push('customer_service');
    if (/财务|会计|审计|出纳|税务|资金|财务分析/i.test(n)) types.push('finance');
    if (/人事|hr|行政|招聘|薪酬|培训|组织发展|人力资源/i.test(n)) types.push('hr_admin');
    if (/设计|ui|ux|视觉|交互|平面|品牌设计|插画/i.test(n)) types.push('design');
    if (/数据|bi|分析|数据仓库|数据治理|数据挖掘/i.test(n)) types.push('data_analytics');
    if (/教育|培训|老师|讲师|教学|课程设计|教务/i.test(n)) types.push('education');
    if (/医疗|护士|医生|药|健康|康复|护理|诊所/i.test(n)) types.push('healthcare');
    if (/法务|律师|合规|法律顾问|知识产权|诉讼/i.test(n)) types.push('legal');
    if (/远程|居家|自由职业|兼职|外包|灵活/i.test(n)) types.push('remote_work');
    if (/创业|自由|个体|独立|副业|合伙/i.test(n)) types.push('entrepreneurship');
    if (types.length === 0) types.push('self_intro', 'career_gap', 'career_change');
    return types;
  }

  function getNextQuestion(session) {
    if (session.followups && session.followups.length > 0) return session.followups.shift();
    if (session.pool.length > 0) { const q = session.pool.shift(); session.asked.push(q.id); return q; }
    const allQ = Object.values(INTERVIEW_DB).flat();
    const rq = allQ[Math.floor(Math.random() * allQ.length)];
    return { ...rq, id: 'fu_' + Date.now(), cat: '深度追问' };
  }

  function generateFollowups(answer, currentQuestion) {
    const text = (answer || '').toLowerCase();
    const followups = [];
    for (const rule of FOLLOWUP_RULES) {
      const regex = new RegExp(rule.keywords);
      if (regex.test(text)) {
        const pool = rule.followups.filter(f => !f.includes(currentQuestion.cat));
        if (pool.length > 0) followups.push(pool[Math.floor(Math.random() * pool.length)]);
      }
    }
    return followups.slice(0, 1).map(q => ({ id: 'fu_' + Date.now(), cat: '深度追问', q, tips: '基于你刚才的回答深入展开', w: 15 }));
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
    const q = session.asked[session.asked.length - 1];
    const analysis = analyzeAnswer(userAnswer, q);

    session.answers.push({ question: q, answer: userAnswer, analysis });
    session.round++;

    // 智能追问：多级链式 + 深度分析
    const followups = generateFollowups(userAnswer, q, session);
    if (followups.length > 0) {
      const fu = followups[0];
      updateFollowupProgress(session, fu);
      session.followups = [...(session.followups || []), fu];
    }

    // 获取下一个问题
    const nextQ = getNextQuestion(session);
    session.currentQ++;

    // 生成 AI 回应
    let aiResponse = '';
    if (analysis.score >= 80) {
      const praises = ['回答得很好，有理有据。', '不错，逻辑清晰，有具体案例。', '很好，这个回答很有深度。', '说得很好，有数据支撑更有说服力。'];
      aiResponse = praises[Math.floor(Math.random() * praises.length)];
    } else if (analysis.score >= 60) {
      aiResponse = '回答有条理，但还可以更深入一些。';
    } else {
      aiResponse = '回答比较简略，建议用具体案例展开说明。';
    }

    // 追问或下一题
    if (session.followups && session.followups.length > 0) {
      aiResponse += '\n\n' + session.followups[0].q;
    } else {
      aiResponse += '\n\n' + nextQ.q;
    }

    return {
      feedback: analysis.feedback,
      score: analysis.score,
      level: analysis.level,
      color: analysis.color,
      isLast: false,
      aiResponse,
      nextQuestion: nextQ,
      round: session.round,
    };
  }

  function endInterview(session) {
    return {
      feedback: '',
      score: 0,
      level: '',
      isLast: true,
      aiResponse: '好的，面试到此结束。正在为你生成面试评估报告...',
      round: session.round,
    };
  }

  function generateInterviewReport(session) {
    const totalScore = Math.round(session.answers.reduce((s, a) => s + a.analysis.score, 0) / session.answers.length);
    const duration = Math.round((Date.now() - session.startTime) / 1000);

    const categoryScores = {};
    for (const a of session.answers) {
      const cat = a.question.cat;
      if (!categoryScores[cat]) categoryScores[cat] = [];
      categoryScores[cat].push(a.analysis.score);
    }
    const avgByCategory = {};
    for (const [cat, scores] of Object.entries(categoryScores)) {
      avgByCategory[cat] = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
    }

    const sorted = Object.entries(avgByCategory).sort((a, b) => b[1] - a[1]);
    const strengths = sorted.filter(([, s]) => s >= 70).map(([cat]) => cat);
    const weaknesses = sorted.filter(([, s]) => s < 60).map(([cat]) => cat);

    let level, color, suggestion;
    if (totalScore >= 85) {
      level = '面试表现优秀';
      color = '#16a34a';
      suggestion = '你的面试表现整体出色。保持自信和条理，面试时注意语速控制和眼神交流。';
    } else if (totalScore >= 70) {
      level = '面试表现良好';
      color = '#2ea56a';
      suggestion = '基础扎实。建议在薄弱环节重点准备，多用 STAR 法则组织回答。';
    } else if (totalScore >= 55) {
      level = '面试表现一般';
      color = '#d97706';
      suggestion = '有一定基础但缺乏亮点。建议准备 3-5 个成功案例并反复练习。';
    } else {
      level = '需要加强准备';
      color = '#dc2626';
      suggestion = '建议系统准备：① 梳理核心优势 ② 准备量化案例 ③ 反复模拟练习。';
    }

    const allKeywords = [...new Set(session.answers.flatMap(a => a.analysis.keywords))];

    return {
      jobName: session.jobName,
      totalScore,
      level,
      color,
      suggestion,
      duration: `${Math.floor(duration / 60)}分${duration % 60}秒`,
      totalQuestions: session.answers.length,
      answeredQuestions: session.answers.length,
      categoryScores: avgByCategory,
      strengths,
      weaknesses,
      keywords: allKeywords,
      details: session.answers.map(a => ({
        question: a.question.q,
        category: a.question.cat,
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
    initInterviewSession, getInterviewFeedback, endInterview, generateInterviewReport
  };
}));
