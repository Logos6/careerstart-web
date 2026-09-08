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
      { id: 'g1', cat: '自我介绍', q: '请做一下自我介绍', tips: '控制在1-2分钟，采用"现在—过去—未来"结构：当前角色/核心能力→1-2个与岗位最相关的成就（用数据支撑）→为什么对这个岗位感兴趣。避免复述简历，要建立"我与岗位的匹配"而非流水账。', w: 20 },
      { id: 'g2', cat: '离职原因', q: '你为什么离开上一家公司？', tips: '向前看而不是向后看，不吐槽前公司/前领导，聚焦个人发展诉求。用"寻求更大发展空间"的方向表达，如"上家公司业务方向收缩，希望找还在发展期的方向深耕"。被裁就直说，2024-2025裁员很普遍，说不清楚反而减分。', w: 20 },
      { id: 'g3', cat: '冲突处理', q: '你如何处理与同事或上级的冲突？', tips: '用STAR法则讲一个靠流程而非靠性格化解分歧的真实案例。重点：主动倾听对方立场→聚焦问题本身而非个人→寻求共同目标→结果。避免描述"你单纯是对的、对方最终承认"的故事。', w: 20 },
      { id: 'g4', cat: '失败反思', q: '请讲一次你失败的经历', tips: '挑一个有明确后果的真实失败，不要伪装成优点的"我太追求完美"。大部分篇幅留给之后的改变：新增的检查流程、提前验证的假设。面试官衡量的是你的经验有没有转化成判断力。', w: 20 },
      { id: 'g5', cat: '薪资谈判', q: '你的期望薪资是多少？', tips: '给一个有依据的区间而非死数字。先查同岗位同城市的市场行情，报"行情中位数→个人量化成果→期望区间→愿意整体沟通"。留出谈判空间，不要报死数也不要说"随便"。', w: 20 },
      { id: 'g6', cat: '职业规划', q: '你未来3-5年的职业规划是什么？', tips: '用"T字型"套路：第1年快速融入成为可靠骨干→2-3年纵向深耕成为某方向专家→4-5年横向拓宽技术视野和影响力。展示成长方向而非具体职位，重点在"我想在什么方向变强"而非"我想当什么官"。', w: 20 },
      { id: 'g7', cat: '学习能力', q: '你最近在学什么新东西？如何保持学习？', tips: '选一个与岗位相关的技术/技能，说清学习动因、渠道（课程/书/实践项目）和小型实践成果。不要只说"我爱学习"，要有具体证据证明你有持续学习的习惯和方法论。', w: 20 },
      { id: 'g8', cat: '沟通能力', q: '描述一次你需要说服别人的经历', tips: '用STAR法则，重点在你的沟通策略：如何理解对方立场→如何组织论据→用了什么沟通方式（数据、案例、演示）→最终结果。强调倾听和理解，而非强压。', w: 20 },
      { id: 'g9', cat: '适应能力', q: '如果入职后发现工作与预期不符，你会怎么办？', tips: '展现适应性与主动精神：①积极了解差距原因并沟通明确期望；②将之视为学习新领域的机会；③制定学习计划快速补齐短板；④定期复盘确保方向一致。避免说"我会忍着"或"我会离职"。', w: 20 },
      { id: 'g10', cat: '求职动机', q: '为什么选择我们公司/这个岗位？', tips: '提前调研公司业务/文化，结合自身职业目标。回答框架：公司优势认可+岗位价值认知+个人适配点+长期发展规划。避免"随便投的""离家近""钱多"等浅层理由。', w: 20 },
      { id: 'g11', cat: '优缺点', q: '你最大的缺点是什么？', tips: '说一个真实的、但对该岗位并非核心的局限，然后描述你用来遏制它的具体机制——不是改进的承诺，而是一项实际的做法。杜绝"我太追求完美"这种虚假回答。', w: 20 },
      { id: 'g12', cat: '抗压能力', q: '请描述一次你面临巨大压力或紧迫截止日期的经历', tips: '用STAR法则：什么项目为何紧急→你的具体职责→如何优先级排序、沟通、寻求资源或创新方法→结果（量化如"提前2天交付"、"错误率降低15%"）。强调抗压能力和问题解决方法。', w: 20 },
      { id: 'g13', cat: '团队合作', q: '你如何看待加班？', tips: '接受合理加班，强调效率优先。框架：①愿意配合关键节点上线和故障处理；②平时通过规范流程和提前规划减少无效加班；③工作效率高，善于通过工具和方法提升产出。避免绝对化回答。', w: 20 },
      { id: 'g14', cat: '反问环节', q: '你有什么问题想问我们吗？', tips: '不要说"没有"，这是最容易避免的错误。准备3-4个高质量问题：①这个岗位入职后前90天最需要解决什么问题？②团队目前最大的挑战是什么？③团队表现最出色的5%的人有什么共同特质？避免一上来就问薪资福利。', w: 20 },
      { id: 'g15', cat: '稳定性', q: '有更好的offer还会选择我们吗？', tips: '表达意向和忠诚度：先说了解过公司文化和岗位方向确实匹配，再表达即使有更好的offer也会认真评估（企业文化、职业规划、学习机会等各方面），目前判断贵司是最优选择。展示你不是来比价的。', w: 15 },
    ],

    // ══════ 2. 自我介绍与职业背景 ══════
    self_intro: [
      { id: 's1', cat: '职业背景', q: '请介绍你的职业经历，你是怎么走到今天这一步的？', tips: '用一条贯穿线串联所有经历，找到非线性职业经历的共同主题。比如"我经历了三个行业，但共同线索是客户体验系统"。不要罗列每个岗位，讲清楚你如何积累到今天的核心能力。', w: 20 },
      { id: 's2', cat: '核心优势', q: '你的核心竞争力是什么？', tips: '选3个与岗位高度匹配的能力标签，每个配一个具体案例和量化成果。如"高效执行力：跨部门对接20余个负责人协作项目，原3个月周期缩短至1个月"。用数据说话，避免空泛的"我很努力"。', w: 25 },
      { id: 's3', cat: '职业亮点', q: '讲一个你最有成就感的项目/经历', tips: '选一个与目标岗位最相关的高光项目，用STAR法则精炼讲述。重点在Action和Result：你做了什么关键决策、带来了什么可衡量的影响。数据化成果是被记住的关键。', w: 25 },
      { id: 's4', cat: '岗位理解', q: '你对这个岗位的工作内容是怎么理解的？', tips: '展示你做过功课：读过JD、了解团队业务方向、知道这个岗位在组织中的定位。用自己的语言复述岗位核心职责，然后说明为什么你的经历和能力与之匹配。', w: 20 },
      { id: 's5', cat: '竞争优势', q: '为什么要在众多面试者中选择你？', tips: '结合岗位需求和个人优势：①核心技能与岗位需求高度契合（用数据量化）；②具备跨领域的复合能力；③非常认同公司理念并有相关经历。三点差异化价值，让面试官看到你的独特性。', w: 25 },
      { id: 's6', cat: '职业故事', q: '用三个词形容你自己，并举例说明', tips: '选择与岗位要求相关的特质标签，每个特质配一个具体事例。如"数据驱动者：通过A/B测试将转化率提升40%"。不要用"性格开朗"这种无效自评，要有证据支撑。', w: 20 },
      { id: 's7', cat: '技能盘点', q: '你具备哪些与岗位相关的技能？', tips: '按硬技能和软技能分类，硬技能给出熟练度和使用场景（如"独立完成12份用户行为分析报告"），软技能通过具体案例展示（如"协调8个部门推进版本上线"）。匹配JD关键词，避免无关技能。', w: 20 },
      { id: 's8', cat: '职业阶段', q: '你目前处于职业发展的什么阶段？', tips: '定位要清晰：如果是0-3年，强调快速成长和可塑性；3-5年强调独立负责模块和方法论沉淀；5年以上强调架构设计和带团队能力。展示你对自身发展阶段有清醒认知。', w: 15 },
      { id: 's9', cat: '工作风格', q: '你的工作风格是怎样的？', tips: '结合岗位需求描述真实的工作方式。如"我习惯用数据驱动决策，每周做数据复盘"或"我喜欢先理清需求再动手，避免返工"。不要说空泛的"认真负责"，要具体到可感知的工作习惯。', w: 20 },
      { id: 's10', cat: '个人品牌', q: '你有什么个人项目/副业/影响力？', tips: '如果有个人项目、技术博客、开源贡献、自媒体运营等，一定要展示。这体现学习能力、热情和自驱力。如"运营技术博客3年，累计阅读量10万+"或"独立开发的小工具被200+人使用"。', w: 15 },
      { id: 's11', cat: '行业认知', q: '你对我们行业/赛道有什么看法？', tips: '展示行业敏感度：最近的趋势、政策变化、技术革新、竞争格局。结合自身经历谈你的观察，不要只说"前景好"，要有具体的行业洞察和思考深度。', w: 20 },
      { id: 's12', cat: '职业转型', q: '你为什么选择转行/转岗？', tips: '不要说前行业/岗位的坏话，聚焦新方向的吸引力。用"迁移能力"框架：过去培养的可迁移能力（沟通、数据分析、项目管理等）如何映射到新岗位需求。你带来的是差异化能力组合，不是零经验。', w: 25 },
      { id: 's13', cat: '领导力', q: '请描述一次你带领团队达成目标的经历', tips: '用STAR法则，重点讲你如何拆解目标、分配任务、激励团队、处理分歧、最终达成结果。即使是小团队或项目组经历也可以，关键是展示你的组织协调和目标导向能力。', w: 25 },
      { id: 's14', cat: '解决问题', q: '举一个你解决过的最复杂的问题', tips: '展示你的分析和解决问题的框架：如何定义问题→如何拆解→尝试了哪些方案→最终怎么解决→学到了什么。面试官考察的是你的思维方式和方法论，而非结果本身。', w: 20 },
      { id: 's15', cat: '成长性', q: '你在过去一年最大的成长是什么？', tips: '选一个具体的成长维度（技能/认知/方法论），讲清楚成长的起点（遇到什么问题/挑战）、过程（如何学习/实践/反思）、结果（能力提升了什么/带来了什么变化）。要有可验证的成果。', w: 20 },
    ],

    // ══════ 3. 职业空白与重返职场 ══════
    career_gap: [
      { id: 'c1', cat: '空白期解释', q: '请解释你简历上的这段职业空白期', tips: '遵循"承认事实→展示价值→聚焦未来"的逻辑闭环。简短交代事实（不回避），重点说这段时间做了什么（学习/考证/家庭管理），最后转向为什么现在适合这个岗位。不要长篇大论解释，也不要流露"求安稳"心态。', w: 25 },
      { id: 'c2', cat: '回归动机', q: '你为什么决定现在重返职场？', tips: '展示强烈的回归意愿和充分准备。如"孩子已入园/家庭后勤已安排妥当/空窗期目标已完成"，说明时机成熟的原因。强调你比以往更成熟、更珍惜机会，而非"找个地方透透气"。', w: 25 },
      { id: 'c3', cat: '技能更新', q: '离开职场这么久，你的技能还能跟上吗？', tips: '用具体证据证明你没有脱节：考取的证书、完成的线上课程、关注的行业动态、参与的项目/志愿活动。如"期间完成了PMP认证，自学了SQL和Python基础，持续关注行业趋势"。给出ramp-up时间预估（如"预计2-3个月达到full productivity"）。', w: 25 },
      { id: 'c4', cat: '稳定性担忧', q: '你家里事情处理好了吗？能全身心投入工作吗？', tips: '主动、具体地说明家庭安排，打消HR对稳定性的顾虑。如"孩子已入园，有老人/保姆负责接送和应对突发，家庭后勤完全安排妥当，能适应出差和项目攻坚"。展现"我已经准备好全情投入"的姿态。', w: 25 },
      { id: 'c5', cat: '全职妈妈优势', q: '全职妈妈这段经历对你重返职场有什么帮助？', tips: '将育儿经历转译为职场语言：多线程项目管理（同时处理多件事）、危机处理（应对突发状况）、资源调度（协调家庭成员）、沟通协调（平衡多方需求）。用具体事例说明，如"每天处理12件高并发任务，跨部门沟通满意度95%"。', w: 25 },
      { id: 'c6', cat: '工作家庭平衡', q: '你怎么平衡工作和家庭？', tips: '不要说"我会尽量兼顾"这种模糊回答。展示你有具体方案：家庭支持系统（老人/保姆/托管）、时间管理方法、弹性工作需求的沟通策略。强调你需要的不是特殊照顾，而是一个合理的支持体系。', w: 25 },
      { id: 'c7', cat: '薪资期望', q: '你对薪资有什么期望？', tips: '不要因为空窗期就自降身价。按市场行情谈判："根据这个岗位的市场行情和我的经验年限，期望在XX-XX区间"。薪资是市场给的，不是按有没有空窗给的。可以接受短期妥协，但要有明确的回升预期。', w: 20 },
      { id: 'c8', cat: '职业连续性', q: '空白期是否会影响你的职业连续性？', tips: '承认有gap但不放大影响，重点讲你做了什么来维持职业敏感度。如"期间持续关注行业动态、与同行保持联系、完成相关认证"。说明虽然离开办公室，但职业能力和判断力从未停止成长。', w: 25 },
      { id: 'c9', cat: '面试准备', q: '针对我们的岗位，你做了哪些准备？', tips: '展示你的主动性和认真程度：研究了公司业务、了解了岗位要求、做了针对性的技能补充、甚至准备了相关作品/方案。用行动证明你不是海投，而是认真选择了这个机会。', w: 20 },
      { id: 'c10', cat: '空窗期学习', q: '在职业空白期你学到了什么新技能？', tips: '列出具体的学习成果：证书名称、课程平台和内容、独立完成的项目。如"完成了Coursera数据分析专项课程，独立做了一个母婴消费数据分析报告"。即使是自学也要有可验证的产出。', w: 25 },
      { id: 'c11', cat: '适应能力', q: '离开职场这么久，你能适应快节奏的工作环境吗？', tips: '用类比展示适应力：育儿期间的高并发任务处理就是对快节奏最好的训练。再补充具体的ramp-up计划："入職后前3个月我会重点做X、Y、Z来快速上手"，给出可量化的时间表。', w: 20 },
      { id: 'c12', cat: '职业规划', q: '重返职场后你的职业规划是什么？', tips: '展示清晰的方向感：短期（1年内）快速适应、证明价值；中期（2-3年）深耕专业领域；长期（3-5年）成为团队骨干。与公司发展方向绑定，表明你不是来过渡的，而是要长期投入。', w: 20 },
      { id: 'c13', cat: '年龄担忧', q: '你觉得自己年龄偏大，如何与年轻同事竞争？', tips: '将年龄转化为优势：丰富的行业经验、成熟的职业判断力、更强的抗压能力和稳定性。"我带来的不是零经验，而是多年积累的方法论和行业洞察，加上更强的自驱力和责任心。"', w: 20 },
      { id: 'c14', cat: '心态调整', q: '这几年没有上班，你的心态有什么变化？', tips: '坦诚但积极：经历了一段时间的沉淀，我更清楚自己想要什么，也更珍惜工作机会。家庭经历让我在时间管理、情绪调节方面更成熟。现在我的状态是"准备好了全力以赴"，而不是"找个工作打发时间"。', w: 20 },
      { id: 'c15', cat: '脱节应对', q: '行业变化很快，你觉得自己跟得上吗？', tips: '不要回避这个问题。列举你关注的行业变化、学的新工具（如AI办公工具）、参加的线上活动。用具体例子证明你一直在"刷新"自己："我每周读X行业资讯，订阅了Y个专业播客，上个月还完成了Z课程的学习。"', w: 25 },
    ],

    // ══════ 9. 客户服务与支持 ══════
    customer_service: [
      { id: 'cs1', cat: '投诉处理', q: '请描述一次你成功处理客户投诉的经历，你是怎么做的？', tips: '用STAR法则：描述情境→你采取的行动→最终结果。重点突出倾听、同理心、解决问题的能力，以及投诉处理后客户满意度的提升。', w: 20 },
      { id: 'cs2', cat: '投诉处理', q: '如果客户对你的处理结果不满意，坚持要投诉到上级，你会怎么办？', tips: '首先保持冷静和专业，不要与客户争辩。表示理解客户情绪，主动提供升级通道，同时做好详细记录。强调"客户投诉是改进的机会"这一理念。', w: 25 },
      { id: 'cs3', cat: '客户满意度', q: '你认为影响客户满意度的关键因素有哪些？你如何在日常工作中提升客户满意度？', tips: '从响应速度、问题解决率、服务态度、个性化服务等维度回答。可以提及CSAT、NPS等指标的理解，展示数据驱动的服务意识。', w: 20 },
      { id: 'cs4', cat: '客户满意度', q: '如何衡量客服团队的服务质量？你会关注哪些核心指标？', tips: '提及CSAT（客户满意度）、NPS（净推荐值）、首次响应时间、平均解决时间、工单积压量等指标。展示你对数据化管理的理解。', w: 25 },
      { id: 'cs5', cat: '服务标准', q: '你认为一个优秀的客服团队应该具备哪些服务标准？', tips: '从响应时效、专业能力、沟通规范、问题闭环、客户反馈机制等方面阐述。强调标准化流程与灵活应变的结合。', w: 15 },
      { id: 'cs6', cat: '团队培训', q: '如果你是客服主管，你会如何培训新入职的客服人员？', tips: '分阶段回答：入职培训（产品知识、系统操作）→带教期（陪听、模拟）→独立期（质检反馈）。强调建立知识库、话术模板和定期复盘机制。', w: 20 },
      { id: 'cs7', cat: '情绪管理', q: '面对情绪激动甚至辱骂你的客户，你如何管理自己的情绪？', tips: '展示情绪管理能力：深呼吸、短暂离开、自我调节。强调"对事不对人"的原则，以及事后通过运动、倾诉等方式释放压力的具体方法。', w: 20 },
      { id: 'cs8', cat: '情绪管理', q: '连续接到多个难缠客户的投诉后，你如何快速调整状态服务下一位客户？', tips: '强调情绪隔离能力：将每一次服务视为独立事件。可以用"30秒重置法"——闭眼深呼吸、整理桌面、切换心态，确保每位客户都获得同等质量的服务。', w: 25 },
      { id: 'cs9', cat: '服务创新', q: '你认为AI客服能完全取代人工客服吗？人工客服的核心价值在哪里？', tips: '不要简单否定或肯定AI客服。指出AI擅长标准化、高频问题处理，而人工客服在复杂情感沟通、个性化服务、危机处理方面不可替代。强调人机协作是未来趋势。', w: 25 },
      { id: 'cs10', cat: 'NPS管理', q: '你了解NPS（净推荐值）吗？如何提升客户对公司的推荐意愿？', tips: '解释NPS的计算方式（推荐者%-贬损者%）。从超预期服务、主动关怀、问题高效解决、个性化体验等角度说明提升策略。可以举出实际提升NPS的案例。', w: 20 },
      { id: 'cs11', cat: 'VIP服务', q: 'VIP客户和普通客户的服务有什么区别？如何为VIP客户提供差异化服务？', tips: '从响应优先级、专属客服通道、定制化解决方案、定期回访、节日关怀等维度回答。强调VIP客户维护对公司长期收益的重要性。', w: 20 },
      { id: 'cs12', cat: '客户流失预防', q: '如果发现某个重要客户有流失倾向，你会采取哪些措施？', tips: '分析流失原因→主动沟通了解不满→提供专属优惠或补偿方案→安排专人跟进。强调客户生命周期管理和预警机制的重要性。', w: 25 },
      { id: 'cs13', cat: '投诉处理', q: '你遇到过最棘手的客户投诉是什么？最后是怎么解决的？', tips: '选择一个有真实细节的案例，描述问题的复杂性、你采取的多步骤行动、协调了哪些资源，以及最终结果和从中学到的经验。', w: 20 },
      { id: 'cs14', cat: '服务标准', q: '在多渠道客服（电话、在线、邮件）场景下，如何保证服务的一致性？', tips: '从统一话术库、跨渠道工单流转、质检标准统一、客户画像共享等方面回答。强调无论渠道如何变化，核心服务标准不变。', w: 25 },
      { id: 'cs15', cat: '客户满意度', q: '客户给了差评后，你会怎么处理？如何避免类似问题再次发生？', tips: '及时响应→真诚道歉→解决问题→跟进回访。然后进行根因分析，推动流程改进，建立知识库，将个案转化为团队学习案例。', w: 20 },
    ],

    // ══════ 17. 远程与灵活办公 ══════
    remote_work: [
      { id: 'rw1', cat: '远程协作', q: '你如何看待远程办公？远程办公和办公室办公最大的区别是什么？', tips: '从信息传递方式、自律要求、协作工具依赖等角度回答。不要只说优点，也要提到挑战及应对方案。核心观点：远程办公更考验自驱力和文档化能力。', w: 20 },
      { id: 'rw2', cat: '远程协作', q: '描述一次你在远程环境下与团队协作完成项目的经历，遇到了什么问题，怎么解决的？', tips: '用具体案例说明：时区差异、沟通延迟、信息不同步等问题。重点讲你采取的措施——异步沟通、文档沉淀、定期同步会议等，以及最终成果。', w: 25 },
      { id: 'rw3', cat: '时间管理', q: '远程办公时你如何管理自己的时间，保证工作效率？', tips: '展示你的时间管理系统：日计划/周计划、番茄工作法、任务优先级矩阵。提及具体工具（Notion、Trello、日历等），强调"结果导向"而非"在线时长"。', w: 20 },
      { id: 'rw4', cat: '时间管理', q: '远程办公时容易被家庭事务干扰，你怎么处理工作和生活的边界？', tips: '诚实回答挑战，但重点放在解决方案上：固定工作时间、独立工作空间、和家人沟通规则、使用专注工具。展示你有清晰的边界管理意识。', w: 15 },
      { id: 'rw5', cat: '沟通效率', q: '远程工作中"过度沟通"和"沟通不足"的边界在哪里？你怎么把握？', tips: '核心原则：同步沟通用于紧急/复杂事项，异步沟通用于日常进展。强调文档化——"能用文字说清楚的不开会，必须开会的要有纪要"。主动同步比被动追问更重要。', w: 25 },
      { id: 'rw6', cat: '沟通效率', q: '你觉得远程办公中最重要的沟通工具是什么？不同场景应该怎么选择工具？', tips: 'IM（快速对齐）、视频会议（复杂讨论/建立信任）、协作文档（决策记录/知识沉淀）、项目管理工具（任务追踪）。强调"选对工具"比"用很多工具"更重要。', w: 20 },
      { id: 'rw7', cat: '团队融入', q: '远程办公如何让新员工快速融入团队？你会怎么做？', tips: '主动介绍自己、参加团队虚拟社交活动、找一个"伙伴"快速了解公司文化、主动约1:1沟通。展示你理解远程环境下的社交挑战并积极应对。', w: 20 },
      { id: 'rw8', cat: '团队融入', q: '远程团队中如何建立信任感？你觉得信任是怎么产生的？', tips: '信任来自三个方面：可靠交付（说到做到）、透明沟通（主动暴露风险）、专业能力。强调"信任=可靠+透明+专业"，通过持续交付高质量工作建立信任。', w: 25 },
      { id: 'rw9', cat: '工作与生活边界', q: '远程办公最大的挑战是什么？你是怎么克服的？', tips: '诚实提到：孤独感、过度工作、干扰多等挑战。重点放在你的应对策略：固定作息、定期运动、设定明确的下班时间、使用物理空间划分工作区。', w: 20 },
      { id: 'rw10', cat: '远程管理', q: '如果你是远程团队的管理者，你会如何评估团队成员的工作表现？', tips: '从结果导向（OKR/KPI）、过程透明（日报/周报）、定期1:1沟通、同事反馈等维度回答。强调"不以在线时长论英雄"，关注产出和协作质量。', w: 25 },
      { id: 'rw11', cat: '异步沟通', q: '什么是异步沟通？远程团队中为什么需要异步沟通能力？', tips: '解释异步沟通vs同步沟通的区别。异步沟通允许在不同时间处理信息，适合跨时区团队。核心能力：清晰的书面表达、完整的上下文提供、不依赖即时回复。', w: 20 },
      { id: 'rw12', cat: '异步沟通', q: '你平时写工作周报或项目同步时，会包含哪些内容？', tips: '结构化回答：本周完成的事项→进行中的事项→遇到的阻塞/风险→下周计划→需要的支持。强调"让不同时区的人也能快速理解上下文"。', w: 15 },
      { id: 'rw13', cat: '跨时区协作', q: '如果团队成员分布在不同时区，你怎么安排协作？', tips: '找到重叠时间集中同步会议，其他时间异步协作。提前准备会议材料，会后及时沉淀文档。展示你对跨时区协作的实际理解。', w: 25 },
      { id: 'rw14', cat: '跨时区协作', q: '远程办公中遇到紧急问题但同事不在线，你会怎么处理？', tips: '第一步：通过文档/Knowledge Base自行查找解决方案。第二步：记录问题并尝试临时解决方案。第三步：给同事留言等待回复。强调自主解决问题的能力和主动性。', w: 20 },
      { id: 'rw15', cat: '远程管理', q: '远程团队如何保持团队凝聚力和士气？', tips: '定期团队社交活动（虚拟咖啡、游戏）、定期1:1关怀、及时认可和表扬、清晰的团队目标和愿景、知识分享会。强调"远程≠孤立"，主动创造连接机会。', w: 20 },
    ],

    // ══════ 18. 创业与自由职业 ══════
    entrepreneurship: [
      { id: 'ep1', cat: '创业经历', q: '请介绍一下你的创业经历，为什么选择创业？', tips: '用"为什么创业→做了什么→结果如何→学到了什么"的逻辑回答。强调创业动机是发现问题/创造价值，而非逃避打工。即使失败也要展示成长。', w: 20 },
      { id: 'ep2', cat: '创业经历', q: '创业失败后，你如何看待这段经历？它给你带来了什么？', tips: '不要回避失败，展示反思能力。可以从商业认知、抗压能力、团队管理、产品思维等方面总结收获。强调"创业失败不是终点，是成长的加速器"。', w: 25 },
      { id: 'ep3', cat: '商业模式', q: '你创业时的商业模式是什么？为什么认为这个模式能成立？', tips: '清晰描述：目标用户是谁→解决什么问题→如何盈利→竞争优势。展示你对商业模式画布的理解，以及用数据验证假设的能力。', w: 25 },
      { id: 'ep4', cat: 'MVP验证', q: '你如何验证你的创业想法？有没有做过MVP（最小可行产品）？', tips: '描述验证过程：用户访谈→需求分析→MVP开发→市场测试→数据反馈→迭代优化。强调"快速验证、小步试错"的精益创业思维。', w: 25 },
      { id: 'ep5', cat: '融资经验', q: '你有融资经验吗？融资过程中最难的是什么？', tips: '从BP准备、路演、谈判、尽调等环节回答。强调融资不仅是找钱，更是找资源和背书。可以提及投资人最关心的问题（市场、团队、壁垒）。', w: 20 },
      { id: 'ep6', cat: '获客策略', q: '你的项目是怎么获取第一批用户的？获客成本是多少？', tips: '描述具体的获客渠道（内容营销、社交裂变、地推、合作等）和策略。用数据说话：CAC（获客成本）、转化率、留存率。展示你对增长黑客的理解。', w: 20 },
      { id: 'ep7', cat: '成本控制', q: '创业过程中你是如何控制成本的？有没有砍过哪些不必要的开支？', tips: '展示你的财务意识：区分"必须花"和"可以省"的钱。可以举例：用开源工具替代付费服务、远程办公节省租金、外包非核心业务等。', w: 20 },
      { id: 'ep8', cat: '团队搭建', q: '你是如何搭建创业团队的？团队成员之间出现分歧怎么处理？', tips: '强调选人标准：价值观一致>能力互补。分歧处理：明确讨论→数据说话→快速决策→执行不回头。展示你在团队建设中的领导力。', w: 20 },
      { id: 'ep9', cat: '失败经验', q: '创业过程中犯过最大的错误是什么？如果重来你会怎么做？', tips: '选一个真实的错误（如选错合伙人、过度开发、忽视市场反馈等），展示反思深度。关键是：不只是说错误，更要说明你从中学到了什么以及现在会怎么做。', w: 25 },
      { id: 'ep10', cat: '失败经验', q: '创业和打工最大的区别是什么？你更倾向于哪种？', tips: '从决策权、风险承担、成长速度、收入稳定性等维度对比。不要贬低任何一种，展示你的成熟思考。如果应聘的是创业公司，强调创业经历让你更理解公司处境。', w: 20 },
      { id: 'ep11', cat: '自由职业', q: '你为什么选择自由职业？自由职业和创业有什么区别？', tips: '自由职业更注重个人专业能力的变现，创业更注重组织化运作和规模化。可以从时间自由度、收入模式、风险程度等方面对比回答。', w: 20 },
      { id: 'ep12', cat: '自由职业', q: '自由职业者如何保证持续的收入来源？你有什么经验？', tips: '从多元化收入渠道回答：多个客户、不同服务类型、被动收入（课程/模板/咨询）。强调客户关系维护和个人品牌建设的重要性。', w: 20 },
      { id: 'ep13', cat: '创业经历', q: '面试官问你"你的创业经历会让你在新岗位上有什么优势"，你怎么回答？', tips: '强调创业培养的能力：全局思维、结果导向、资源有限下的创新能力、抗压能力、快速学习能力。将创业经验与目标岗位需求关联起来。', w: 25 },
      { id: 'ep14', cat: '商业模式', q: '你认为一个好项目需要具备哪些条件？', tips: '从市场需求（痛点真实且足够大）、团队能力（能交付解决方案）、商业模式（能持续盈利）、竞争壁垒（不容易被复制）四个维度回答。', w: 15 },
      { id: 'ep15', cat: '获客策略', q: '如果你的竞争对手用低价策略抢客户，你会怎么应对？', tips: '不要只说"也降价"。从差异化价值（服务/品质/品牌）、客户细分（聚焦高端市场）、成本优化（提高效率降成本）等角度回答。强调"打价格战是下策"。', w: 25 },
    ],

    // ══════ 19. 转行与职业转型 ══════
    career_change: [
      { id: 'cc1', cat: '转行动机', q: '你为什么选择转行？是什么促使你离开原来的行业？', tips: '不要说原行业不好，从正向角度阐述：对新行业的热情+原行业的积累如何迁移到新领域。公式=找相似拉近差距+夸新行业发展优势', w: 20 },
      { id: 'cc2', cat: '转行动机', q: '你对我们这个行业了解多少？做过哪些功课？', tips: '展示你对目标行业的深入研究：行业趋势、头部公司、核心业务模式、近期动态。切忌泛泛而谈，要具体到数据和案例', w: 20 },
      { id: 'cc3', cat: '技能迁移', q: '你之前的工作经验和现在应聘的岗位有什么关联？', tips: '找到原行业与新岗位的技能交叉点，如沟通能力、项目管理、数据分析等通用能力。用具体案例证明你已具备部分核心技能', w: 20 },
      { id: 'cc4', cat: '技能迁移', q: '你觉得原来行业积累的哪些能力可以带到新岗位？', tips: '用STAR法则举例说明可迁移技能：领导力、客户沟通、问题解决、资源整合等。量化成果更有说服力', w: 20 },
      { id: 'cc5', cat: '差距分析', q: '你觉得自己转行最大的短板是什么？打算怎么弥补？', tips: '诚实承认不足但同时展示学习计划：已自学/考证/做项目。体现你的自我认知能力和主动学习意识', w: 25 },
      { id: 'cc6', cat: '差距分析', q: '你的专业背景和这个岗位不匹配，我们为什么要录用你而不是科班出身的？', tips: '强调你的差异化优势：跨界视野、不同行业经验带来的独特视角、更强的学习能力和适应力', w: 25 },
      { id: 'cc7', cat: '准备程度', q: '你为转行做了哪些具体准备？', tips: '展示系统性的准备：考取相关证书、参加培训课程、做个人项目/作品集、行业人脉积累、关注行业资讯等', w: 20 },
      { id: 'cc8', cat: '准备程度', q: '你在空窗期（转行准备期）做了什么？', tips: '用FACT+BRIDGE+PIVOT公式：承认事实→展示这段时间的学习和成长→转折到为什么适合这个岗位', w: 20 },
      { id: 'cc9', cat: '行业认知', q: '你怎么看我们这个行业未来3-5年的发展趋势？', tips: '结合政策、技术、市场三个维度分析，展示你的行业洞察力。可以提及AI影响、消费升级、政策导向等', w: 25 },
      { id: 'cc10', cat: '行业认知', q: '你觉得原来行业和现在想进入的行业最大的区别是什么？', tips: '从商业模式、工作节奏、人才结构、企业文化等维度对比，展现深入思考而非表面认知', w: 20 },
      { id: 'cc11', cat: '薪资谈判', q: '转行可能意味着降薪，你能接受吗？', tips: '表达对岗位的重视超过短期薪资，但也要合理展示自己的价值预期。可以说看重成长空间和长期发展', w: 20 },
      { id: 'cc12', cat: '风险评估', q: '如果你转行后发现不适合怎么办？', tips: '展示你的深思熟虑而非冲动决定，说明你已经通过多种方式验证过自己的选择，强调适应能力和长期投入的决心', w: 25 },
      { id: 'cc13', cat: '稳定性', q: '你怎么保证转行后不会做几个月又想换？', tips: '展示你对新行业的长期规划和热情来源，说明转行是经过慎重考虑的决定而非一时兴起', w: 20 },
      { id: 'cc14', cat: '成功案例', q: '你身边有没有成功转行的案例？他们的经验对你有什么启发？', tips: '展示你的行业调研能力和社交网络，通过他人的成功经验间接证明转行的可行性', w: 15 },
      { id: 'cc15', cat: '自我认知', q: '你的朋友/前同事会怎么评价你适合做什么类型的工作？', tips: '通过第三方视角展示你的核心优势和性格特质，同时自然引出这些特质与目标岗位的匹配度', w: 15 },
    ],

    // ══════ 20. 压力与情绪管理 ══════
    pressure: [
      { id: 'ps1', cat: '压力认知', q: '你怎么看待加班？能接受高强度的工作节奏吗？', tips: '第一步强调如果工作需要愿意加班，第二步强调自己的工作效率高会尽量避免无效加班。不要直接说不接受也不要无底线接受', w: 20 },
      { id: 'ps2', cat: '压力认知', q: '你觉得压力是好事还是坏事？', tips: '辩证回答：适度压力能激发潜能、提升效率，但长期高压需要学会调节。举例说明你如何把压力转化为动力', w: 20 },
      { id: 'ps3', cat: '情绪管理', q: '当你在工作中遇到挫折或被批评时，你会怎么处理？', tips: '展示成熟的自我调节能力：先接受情绪→冷静分析原因→找解决方案→总结经验。避免说"我不会受影响"这种不真实的回答', w: 25 },
      { id: 'ps4', cat: '情绪管理', q: '如果领导当众批评你，你会怎么反应？', tips: '强调尊重领导、不当场反驳、事后主动沟通。用具体案例说明你如何把批评转化为改进动力', w: 25 },
      { id: 'ps5', cat: '高压环境', q: '描述一个你在高压环境下完成任务的经历', tips: '用STAR法则：具体情境→任务目标→你采取的行动→最终结果。突出你的时间管理、优先级排序和抗压能力', w: 25 },
      { id: 'ps6', cat: '高压环境', q: '如果同时有多个紧急任务压过来，你怎么处理？', tips: '展示你的优先级排序能力：评估紧急程度和重要性→合理分配时间→必要时寻求帮助→保证交付质量', w: 20 },
      { id: 'ps7', cat: '挫折应对', q: '你经历过最大的工作失败是什么？你是怎么走出来的？', tips: '选择真实的失败案例，重点放在：你从中学到了什么、如何调整心态、之后如何避免类似问题。展示成长型思维', w: 25 },
      { id: 'ps8', cat: '挫折应对', q: '如果项目失败了，责任在你，你会怎么做？', tips: '展示担当：先承认责任→分析原因→制定补救方案→总结教训。避免推卸责任或过度自责', w: 20 },
      { id: 'ps9', cat: '自我调节', q: '你在工作之余怎么减压？', tips: '展示健康的减压方式：运动、阅读、社交等。同时暗示你有良好的生活习惯，能长期保持工作状态', w: 15 },
      { id: 'ps10', cat: '自我调节', q: '你怎么保持工作和生活的平衡？', tips: '强调高效工作是为了更好的生活，展示你的时间管理能力。同时表达对工作的投入和热情', w: 20 },
      { id: 'ps11', cat: '完美主义', q: '你觉得自己是完美主义者吗？这在工作中有什么影响？', tips: '承认有完美主义倾向但会控制在合理范围：重要事情追求完美，日常任务注重效率。展示你的自我认知', w: 20 },
      { id: 'ps12', cat: '抗压能力', q: '如果连续加班一个月，你还能保持高效工作吗？', tips: '诚实地说明你的应对策略：合理安排休息、调整工作方法、保持身体健康。展示可持续的工作方式', w: 20 },
      { id: 'ps13', cat: '冲突处理', q: '如果和同事发生矛盾影响了工作情绪，你怎么办？', tips: '强调以工作为重：先处理情绪再处理事情、主动沟通化解误会、必要时请第三方协调。展示成熟的职业态度', w: 20 },
      { id: 'ps14', cat: '压力面试', q: '面试官质疑你的能力：你觉得你凭什么胜任这个岗位？（压力面）', tips: '这是压力面试！保持冷静不被激怒，用事实和数据反驳，同时保持谦逊。承认不足但强调优势和潜力', w: 25 },
      { id: 'ps15', cat: '动力维持', q: '当工作遇到瓶颈期，缺乏动力的时候，你怎么办？', tips: '展示你的自我驱动能力：重新审视目标、寻找新的挑战点、向优秀同事学习、调整心态。避免说"找领导谈"这种被动回答', w: 20 },
    ],

    // ══════ 21. 团队协作与沟通 ══════
    teamwork: [
      { id: 'tw1', cat: '冲突解决', q: '你和同事意见不合时，你会怎么处理？', tips: '强调以工作目标为导向：先倾听理解对方→表达自己的观点→寻找共识→必要时妥协。展示你不是固执的人', w: 25 },
      { id: 'tw2', cat: '冲突解决', q: '如果你的方案被团队否定了，你会怎么做？', tips: '展示开放心态：先理解否定的原因→反思自己方案的不足→吸收他人意见改进。避免说"坚持自己的想法"', w: 20 },
      { id: 'tw3', cat: '跨部门协作', q: '你有没有跨部门合作的经验？遇到过什么困难？', tips: '用STAR法则描述具体案例，重点放在沟通协调能力、换位思考、推动事情进展的能力上', w: 25 },
      { id: 'tw4', cat: '跨部门协作', q: '如果其他部门不配合你的工作，你怎么办？', tips: '展示你的协调能力：先了解对方的顾虑→找到共赢方案→必要时升级协调。强调沟通而非对抗', w: 25 },
      { id: 'tw5', cat: '向上管理', q: '如果和上级意见不一致，你会怎么处理？', tips: 'STEP1自我检查→STEP2诚意沟通→STEP3顾及面子。用谦逊的态度表达观点，同时尊重领导的决策权', w: 25 },
      { id: 'tw6', cat: '向上管理', q: '你认为和上级沟通最重要的是什么？', tips: '展示你的沟通智慧：及时汇报、主动反馈、理解上级意图、站在上级角度思考问题。避免说"听话"', w: 20 },
      { id: 'tw7', cat: '团队贡献', q: '在团队项目中，你通常扮演什么角色？', tips: '根据真实性格回答，可以是：问题解决者、协调者、执行者、创新者等。用具体案例证明', w: 15 },
      { id: 'tw8', cat: '团队贡献', q: '你为团队做过最有价值的一件事是什么？', tips: '用STAR法则讲述具体贡献，量化成果。强调你的主动性和对团队目标的推动作用', w: 20 },
      { id: 'tw9', cat: '沟通风格', q: '你觉得自己的沟通风格是什么样的？', tips: '诚实描述：是直接型还是委婉型，是倾听型还是表达型。同时说明你能根据对象调整沟通方式', w: 15 },
      { id: 'tw10', cat: '沟通风格', q: '你怎么向不太懂技术的同事解释一个复杂概念？', tips: '展示你的换位思考和表达能力：用对方能理解的语言、举生活中的例子、分步骤解释、确认对方理解', w: 20 },
      { id: 'tw11', cat: '反馈能力', q: '你怎么给同事提建设性意见？', tips: '强调尊重和善意：先肯定优点→提出改进建议→给出具体方案。避免说"你的问题在于..."这种指责式表达', w: 20 },
      { id: 'tw12', cat: '反馈能力', q: '当别人给你负面反馈时，你的第一反应是什么？', tips: '展示成熟心态：先接受→冷静分析是否有道理→有则改之无则加勉。避免说"我不在意别人的看法"', w: 20 },
      { id: 'tw13', cat: '会议效率', q: '你讨厌什么样的会议？你怎么让会议更高效？', tips: '展示你的效率意识：会前准备议题、会中控制时间、会后跟进执行。可以适当吐槽低效会议但要给出解决方案', w: 15 },
      { id: 'tw14', cat: '影响力', q: '你有没有在没有职权的情况下影响过别人的决定？', tips: '用具体案例展示你的影响力：通过数据说服、通过案例论证、通过情感共鸣。这是非常重要的软技能', w: 25 },
      { id: 'tw15', cat: '团队建设', q: '你觉得一个好的团队应该是什么样的？', tips: '展示你的团队价值观：目标清晰、分工明确、相互信任、有效沟通、共同成长。避免说"氛围好"这种空话', w: 15 },
    ],

    // ══════ 22. 决策与问题解决 ══════
    decision: [
      { id: 'dc1', cat: '艰难决策', q: '你做过的最难的一个决定是什么？', tips: '选择真实的艰难决定，重点描述决策过程而非结果。展示你如何权衡利弊、收集信息、最终拍板', w: 25 },
      { id: 'dc2', cat: '艰难决策', q: '你在信息不完整的情况下做过什么重要决定吗？', tips: '展示你的风险评估能力：如何在有限信息下做出合理判断、设定止损点、准备Plan B', w: 25 },
      { id: 'dc3', cat: '风险决策', q: '你有没有冒过比较大的职业风险？结果如何？', tips: '选择有真实代价的风险决策，展示你的勇气和复盘能力。即使失败了也要说明你学到了什么', w: 25 },
      { id: 'dc4', cat: '风险决策', q: '如果一个项目有50%的失败概率，你会建议启动吗？', tips: '展示你的分析框架：评估失败的后果和成功的收益、是否有替代方案、团队的承受能力、止损机制', w: 20 },
      { id: 'dc5', cat: '创新思维', q: '你有没有提出过创新的想法或方案？是怎么落地的？', tips: '用STAR法则描述：发现问题→提出创新方案→说服团队→实施落地→量化效果。强调你的创新意识和执行力', w: 20 },
      { id: 'dc6', cat: '创新思维', q: '你觉得工作中应该怎么平衡创新和稳妥？', tips: '辩证思考：在核心业务上保持稳健，在边缘业务上鼓励创新。展示你的务实创新观', w: 20 },
      { id: 'dc7', cat: '问题分析', q: '你一般怎么分析和解决一个复杂问题？', tips: '展示你的分析框架：定义问题→拆解子问题→收集数据→找根本原因→制定方案→验证效果。避免说"凭经验"', w: 25 },
      { id: 'dc8', cat: '问题分析', q: '你有没有遇到过表面原因和根本原因不一样的情况？', tips: '用5Why分析法等工具展示你的深度思考能力，说明你不会被表象迷惑，会追根溯源', w: 20 },
      { id: 'dc9', cat: '系统思维', q: '你在做决策时会考虑哪些因素？', tips: '展示你的全面性：短期vs长期影响、直接vs间接影响、对不同相关方的影响、风险和机会并存', w: 20 },
      { id: 'dc10', cat: '系统思维', q: '你觉得一个好的决策流程应该是怎样的？', tips: '展示你的结构化思维：明确目标→收集信息→制定备选方案→评估风险→做出选择→跟踪反馈', w: 20 },
      { id: 'dc11', cat: '数据驱动', q: '你做决策时更依赖数据还是直觉？', tips: '辩证回答：数据是基础但需要经验判断做补充。展示你既重视数据又不被数据束缚的决策风格', w: 20 },
      { id: 'dc12', cat: '数据驱动', q: '有没有数据看起来很好但你直觉告诉你不对的案例？', tips: '展示你的商业敏感度和批判性思维，说明你不会盲目迷信数据，会结合经验和常识判断', w: 25 },
      { id: 'dc13', cat: '快速决策', q: '工作中经常需要快速决策，你怎么保证决策质量？', tips: '展示你的快速决策框架：区分紧急vs重要、抓关键变量、设定决策时限、准备好纠错机制', w: 20 },
      { id: 'dc14', cat: '决策复盘', q: '你有没有做过一个事后证明是错误的决定？你学到了什么？', tips: '诚实面对错误，重点放在复盘和成长：错在哪里、为什么错、之后如何改进决策过程。展示成长型思维', w: 25 },
      { id: 'dc15', cat: '资源分配', q: '当资源有限时，你怎么决定优先级？', tips: '展示你的优先级框架：ROI分析、战略重要性、紧急程度、团队能力匹配度。避免说"听领导安排"', w: 20 },
    ],

    // ══════ 23. 宝妈专属深度题 ══════
    mom_special: [
      { id: 'ms1', cat: '空窗期解释', q: '你这几年没工作，在做什么？', tips: 'FACT+BRIDGE+PIVOT公式：承认事实→强调这段时间的技能提升和能力成长→转折到为什么现在适合这个岗位。不要道歉式回答', w: 25 },
      { id: 'ms2', cat: '空窗期解释', q: '你简历上的空白期我们怎么理解？', tips: '用职业化语言重新定义：职业休整期/技能提升期。列出这段时间的具体学习成果、证书、自学技能。展示你从未停止成长', w: 20 },
      { id: 'ms3', cat: '工作家庭平衡', q: '你怎么平衡工作和家庭？如果孩子生病了怎么办？', tips: '主动提供解决方案：已安排好家庭后勤（老人/保姆接送）、有Plan B应对突发情况。展示你已准备好全情投入', w: 25 },
      { id: 'ms4', cat: '工作家庭平衡', q: '这个岗位需要加班/出差，你能接受吗？', tips: '诚实说明你的底线，同时展示你的灵活性：在后勤安排妥当时可以接受合理加班。不要无底线承诺也不要直接拒绝', w: 20 },
      { id: 'ms5', cat: '能力优势', q: '你觉得当妈妈这件事对你的工作有什么帮助？', tips: '将育儿经验转化为职场技能：多任务管理、危机处理、情绪管理、耐心沟通、预算规划。用商业语言描述家庭经验', w: 20 },
      { id: 'ms6', cat: '能力优势', q: '你说你有项目管理能力，能具体说说吗？', tips: '将家庭事务转化为项目管理案例：家庭装修、大型旅行统筹、孩子教育规划等。用STAR法则展示统筹协调能力', w: 20 },
      { id: 'ms7', cat: '稳定性', q: '你为什么现在想出来工作了？能稳定吗？', tips: '强调这是经过深思熟虑的决定：家庭阶段性目标已完成、孩子已入园、家庭后勤安排妥当。展示你对工作的渴望和长期投入的决心', w: 25 },
      { id: 'ms8', cat: '稳定性', q: '如果家里有事和工作冲突，你怎么选？', tips: '展示你的职业态度：工作时间内全情投入，同时有完善的后勤保障减少冲突。避免说"家庭第一"，也不要忽略家庭', w: 20 },
      { id: 'ms9', cat: '学习能力', q: '你离开职场这么久，怎么跟上行业发展？', tips: '展示你的学习成果：自学课程、关注行业资讯、参加社群活动、做个人项目等。证明你没有与行业脱节', w: 25 },
      { id: 'ms10', cat: '学习能力', q: '你会用现在的新工具和技术吗？', tips: '展示你对数字化工具的了解和学习能力：AI办公工具、协作软件、数据分析工具等。消除"宝妈不懂技术"的偏见', w: 20 },
      { id: 'ms11', cat: '竞争劣势', q: '你觉得自己和一直在职场的人相比，有什么劣势？', tips: '诚实承认但不过度贬低：可能在行业新趋势上需要补课，但你的成熟度、抗压能力和沟通协调能力是优势', w: 20 },
      { id: 'ms12', cat: '竞争劣势', q: '你准备怎么弥补这几年的职场空窗？', tips: '展示具体的学习计划和行动：考证、做项目、向前辈请教、快速适应。表达你有紧迫感和行动力', w: 20 },
      { id: 'ms13', cat: '职场回归', q: '你入职后打算怎么快速适应工作节奏？', tips: '展示你的适应策略：主动了解公司文化、多向同事请教、用之前的经验快速上手、给自己设定学习时间表', w: 20 },
      { id: 'ms14', cat: '职场回归', q: '你觉得全职妈妈重返职场最大的困难是什么？你怎么克服？', tips: '展示自我认知和解决方案：时间管理需要调整→已做好后勤安排；行业知识需要更新→已在自学。强调你有行动计划', w: 20 },
      { id: 'ms15', cat: '心态建设', q: '你怎么看待自己从全职妈妈到职场人的身份转变？', tips: '展示积极心态：这是两个不同阶段的人生经历，都让我成长。现在孩子长大了，正是我精力充沛重返职场的最佳时机。不要表现出歉意或不安', w: 20 },
    ],

    // ══════ 4. 管理与领导力 ══════
    management: [
      { id: 'mg1', cat: '领导力', q: '请分享一次你领导团队完成目标的经历', tips: '用STAR法则，重点描述你如何制定目标、分工授权、激励团队和推动执行', w: 20 },
      { id: 'mg2', cat: '领导力', q: '你认为一个优秀的管理者应该具备哪些核心能力？', tips: '从战略思维、沟通协调、人才培养、决策判断四个维度回答，结合自身经历举例', w: 15 },
      { id: 'mg3', cat: '领导力', q: '在没有正式职权的情况下，你如何影响和推动团队达成目标？', tips: '强调影响力而非权力，举例说明如何通过专业能力、沟通技巧和资源整合推动工作', w: 25 },
      { id: 'mg4', cat: '团队管理', q: '如果团队中有成员不配合工作，你会如何处理？', tips: '采用理解-沟通-推动三步法，先了解原因再针对性解决，最后推动团队向前', w: 20 },
      { id: 'mg5', cat: '团队管理', q: '请描述一次你处理团队成员之间冲突的经历', tips: '说明冲突背景、你的介入方式、沟通策略和最终结果，展现协调能力', w: 20 },
      { id: 'mg6', cat: '团队管理', q: '你如何激励团队成员，特别是当团队士气低落时？', tips: '结合具体案例，说明你采用的激励方式（物质/精神/成长），以及效果', w: 20 },
      { id: 'mg7', cat: '绩效考核', q: '你如何看待绩效考核在企业管理中的作用？', tips: '强调绩效管理是目标设定-反馈-评估-改进的闭环，而非简单打分定级', w: 20 },
      { id: 'mg8', cat: '绩效考核', q: '如果员工对绩效考核结果有异议，你会如何处理？', tips: '按倾听-核实-沟通-长效机制的流程回答，展现公平性和沟通技巧', w: 25 },
      { id: 'mg9', cat: '冲突处理', q: '请分享一个你协调多方利益相关者、达成共同目标的经历', tips: '重点展示如何识别各方核心关切、设计共赢方案、推动共识形成', w: 25 },
      { id: 'mg10', cat: '冲突处理', q: '当你和上级意见不一致时，你会怎么处理？', tips: '先执行再反馈，用数据和事实支持自己的观点，尊重最终决策', w: 20 },
      { id: 'mg11', cat: '战略规划', q: '你如何制定团队的年度工作计划和目标？', tips: '从公司战略分解、团队能力评估、资源匹配、里程碑设定等角度回答', w: 25 },
      { id: 'mg12', cat: '战略规划', q: '你认为管理者在变革管理中应该扮演什么角色？', tips: '从变革推动者、沟通桥梁、阻力化解者、文化塑造者等角度阐述', w: 25 },
      { id: 'mg13', cat: '人才培养', q: '你是如何培养和辅导下属成长的？', tips: '举例说明导师制、轮岗、项目历练、定期反馈等具体培养方式', w: 20 },
      { id: 'mg14', cat: '人才培养', q: '请描述一次你招聘和选拔人才的经历，你是如何判断候选人是否合适的？', tips: '说明岗位分析、面试评估维度、背景调查、试用期跟踪等完整流程', w: 20 },
      { id: 'mg15', cat: '团队建设', q: '你如何搭建一个高效的团队？从选人到留人有什么策略？', tips: '从人才画像、招聘标准、文化建设、激励机制、成长空间等维度回答', w: 25 },
      { id: 'mg16', cat: '团队建设', q: '如何平衡公司利益和员工权益，做到公平公正？', tips: '结合制度建设、透明沟通、申诉机制等方面回答，体现管理者的公正性', w: 20 },
      { id: 'mg17', cat: '团队建设', q: '你认为管理风格应该一成不变还是因人而异？', tips: '强调情境领导力，根据下属成熟度和任务性质灵活调整管理方式', w: 20 },
      { id: 'mg18', cat: '团队建设', q: '面对团队成员职业倦怠，你会采取哪些措施帮助解决？', tips: '从工作调整、成长规划、心理关怀、环境改善等角度提出系统性方案', w: 20 },
    ],

    // ══════ 6. 销售与商务 ══════
    sales: [
      { id: 'sl1', cat: '客户开发', q: '请描述一次你开拓新客户的完整过程和思路', tips: '说明客户画像分析、触达方式、需求挖掘、方案呈现、跟进策略的完整链路', w: 20 },
      { id: 'sl2', cat: '客户开发', q: '如果你负责一个完全陌生的区域市场，你会如何开展销售工作？', tips: '从市场调研、竞品分析、目标客户筛选、渠道建设、资源获取等角度回答', w: 25 },
      { id: 'sl3', cat: '客户开发', q: '你通常通过哪些渠道获取潜在客户？效果最好的是哪个？', tips: '结合自身经验说明多种获客方式（展会、转介绍、线上营销、陌拜等），用数据说明效果', w: 20 },
      { id: 'sl4', cat: '业绩压力', q: '请分享一次你在巨大业绩压力下完成目标的经历', tips: '说明压力背景、你的应对策略、具体行动和最终结果，展现抗压能力', w: 20 },
      { id: 'sl5', cat: '业绩压力', q: '如果连续三个月没有完成销售指标，你会怎么做？', tips: '分析原因（方法/客户/产品/市场），调整策略，寻求资源支持，保持积极心态', w: 20 },
      { id: 'sl6', cat: '业绩压力', q: '你怎么看待销售工作中的拒绝和失败？', tips: '展现积极心态，说明如何从拒绝中学习，保持持续跟进的韧性', w: 15 },
      { id: 'sl7', cat: '销售技巧', q: '你认为做好销售最关键的能力是什么？', tips: '结合自身经历说明（如需求洞察、关系建立、方案设计、谈判能力等），避免泛泛而谈', w: 15 },
      { id: 'sl8', cat: '销售技巧', q: '请描述一次你说服一个犹豫不决的客户最终成交的经历', tips: '说明客户顾虑、你的分析判断、采取的行动和最终结果', w: 20 },
      { id: 'sl9', cat: '销售技巧', q: '如果客户说"你们的价格太贵了"，你会怎么回应？', tips: '不要急于降价，先了解客户对比对象，强调价值而非价格，提供差异化方案', w: 20 },
      { id: 'sl10', cat: '抗压能力', q: '你如何看待销售这份工作？为什么选择做销售？', tips: '展示对销售工作的热爱和理解，说明销售对个人成长的价值', w: 15 },
      { id: 'sl11', cat: '抗压能力', q: '请简单写下你之前公司的销售流程及你常用的销售方法和技巧', tips: '系统性描述完整销售流程，突出自己在关键环节的方法论', w: 20 },
      { id: 'sl12', cat: '行业认知', q: '你怎么看待我们这个行业？你觉得行业的重点发展是什么？', tips: '提前研究行业趋势、竞争格局、政策环境，展现专业度和商业敏感度', w: 20 },
      { id: 'sl13', cat: '行业认知', q: '如果你是我们公司的销售，面对一个对产品完全不了解的陌生客户，你如何开始推销？', tips: '先了解需求再推荐产品，用利益点语言而非功能语言，展示客户需求导向', w: 20 },
      { id: 'sl14', cat: '商务谈判', q: '请分享一次你与客户进行重要商务谈判的经历', tips: '说明谈判前准备、谈判策略、让步技巧和最终结果，展现双赢思维', w: 25 },
      { id: 'sl15', cat: '商务谈判', q: '当客户提出超出你权限的要求时，你会怎么处理？', tips: '说明权限边界意识、向上沟通机制、客户安抚策略和替代方案设计', w: 20 },
      { id: 'sl16', cat: '商务谈判', q: '如何维护老客户关系，提升客户复购率？', tips: '从定期回访、增值服务、需求跟进、关系维护等角度说明系统性方法', w: 20 },
      { id: 'sl17', cat: '商务谈判', q: '你认为大客户营销和个人客户营销有什么区别？', tips: '从决策链、关系维护、方案定制、周期长短等维度对比分析', w: 20 },
    ],

    // ══════ 7. 市场与品牌 ══════
    marketing: [
      { id: 'mk1', cat: '品牌策略', q: '你如何理解品牌定位？请举例说明一个你认为品牌定位成功的案例', tips: '从目标人群、差异化价值、传播一致性等角度分析，结合具体品牌案例', w: 20 },
      { id: 'mk2', cat: '品牌策略', q: '如果让你从零开始为一个新品牌做市场推广，你会怎么做？', tips: '按洞察-策略-执行-评估框架回答，覆盖用户画像、渠道选择、传播创意、ROI预期', w: 25 },
      { id: 'mk3', cat: '品牌策略', q: '你如何看待品牌短期销量和长期品牌建设之间的矛盾？', tips: '提出以短期促长期、以长期带短期的平衡思路，用具体案例佐证', w: 25 },
      { id: 'mk4', cat: '用户增长', q: '你怎么理解"用户增长"这个概念？和"拉新"有什么关系？', tips: '用AARRR模型说明增长是系统工程，拉新只是第一步，更重要的是激活、留存和传播', w: 20 },
      { id: 'mk5', cat: '用户增长', q: '如果月活用户增长停滞了，你会从哪些维度分析原因？', tips: '从渠道、产品、竞品、市场环境等维度拆解，提出数据驱动的分析方法', w: 25 },
      { id: 'mk6', cat: '用户增长', q: '你有哪些用户拉新的方法？效果最好的是哪种？', tips: '区分有偿和无偿方式，结合具体产品说明不同方法的适用场景和效果', w: 20 },
      { id: 'mk7', cat: '营销策划', q: '请描述一次你策划的成功营销活动，说明活动目标、执行过程和效果', tips: '用数据量化结果（曝光量、转化率、ROI），说明策划思路和关键决策点', w: 20 },
      { id: 'mk8', cat: '营销策划', q: '如果给你10万预算，让你在一个月内策划一场拉新活动，你会怎么做？', tips: '明确目标、确定人群、设计玩法、分配预算、设定监控指标，体现系统性思维', w: 25 },
      { id: 'mk9', cat: '营销策划', q: '你如何评估一个营销活动的ROI？如果ROI低于预期你会怎么办？', tips: '说明ROI计算方法、多维度评估指标、归因模型，以及优化策略', w: 25 },
      { id: 'mk10', cat: '数据分析', q: '你常用哪些数据分析工具？如何用数据驱动营销决策？', tips: '介绍SQL、Excel、BI工具等，说明从数据采集到决策落地的完整链路', w: 20 },
      { id: 'mk11', cat: '数据分析', q: '如果某篇推广文章阅读量很低，你会从哪些方面排查原因？', tips: '从标题、内容质量、发布时间、渠道选择、用户匹配等维度分析', w: 20 },
      { id: 'mk12', cat: '渠道推广', q: '你如何看待抖音、小红书、B站等新媒体渠道在营销中的作用？', tips: '分析各平台用户特征和营销价值，说明差异化投放策略', w: 20 },
      { id: 'mk13', cat: '渠道推广', q: '如果让你负责一个新品的全渠道推广，你会如何分配预算？', tips: '根据不同渠道特性、目标人群和转化链路，说明预算分配逻辑', w: 25 },
      { id: 'mk14', cat: '市场调研', q: '你如何做竞品分析？分析的维度有哪些？', tips: '从产品、定价、渠道、推广、用户口碑等维度说明分析框架', w: 20 },
      { id: 'mk15', cat: '市场调研', q: '你认为我们公司产品目前面临的主要市场竞争挑战是什么？', tips: '提前研究目标公司和竞品，提出有见地的分析和建议', w: 25 },
      { id: 'mk16', cat: '市场调研', q: '你如何看待直播电商对传统电商营销的影响？', tips: '分析直播电商的优势和局限，说明品牌如何应对新渠道变化', w: 20 },
      { id: 'mk17', cat: '市场调研', q: '如果让你从零开始运营一个品牌的抖音账号，你会怎么做？', tips: '从账号定位、内容规划、发布节奏、互动运营、数据优化等角度回答', w: 25 },
    ],

    // ══════ 8. 运营与项目管理 ══════
    operations: [
      { id: 'op1', cat: '用户运营', q: '你认为运营是什么？运营最核心的工作是什么？', tips: '强调运营是连接产品和用户的桥梁，核心是通过策略和手段实现业务增长', w: 15 },
      { id: 'op2', cat: '用户运营', q: '如何做用户分层及运营？你会用什么模型？', tips: '介绍RFM模型等分层方法，说明针对不同层级用户的差异化运营策略', w: 20 },
      { id: 'op3', cat: '用户运营', q: '如果用户次日留存率只有20%，你会怎么分析和提升？', tips: '先确认数据准确性，再拆解流失节点，提出可验证的假设和实验方案', w: 25 },
      { id: 'op4', cat: '活动策划', q: '请描述一次你策划并执行的活动，从立题到复盘的完整过程', tips: '按目标设定-方案设计-执行推进-效果评估-经验复盘的闭环描述', w: 20 },
      { id: 'op5', cat: '活动策划', q: '如果活动上线后数据不及预期，你会怎么处理？', tips: '快速判断严重程度，从流量、转化、留存三个环节归因，小范围调整测试', w: 20 },
      { id: 'op6', cat: '活动策划', q: '你做过哪些不错的运营案例？请详细介绍', tips: '选择与目标岗位最相关的案例，用数据说明效果，突出个人贡献', w: 20 },
      { id: 'op7', cat: '数据分析', q: '昨天新增用户下降了30%，你会怎么查原因？', tips: '按渠道-产品-外部环境-数据异常的排查顺序，展示系统性分析思路', w: 25 },
      { id: 'op8', cat: '数据分析', q: '你关注运营数据吗？过去有没有一些相关经历？', tips: '说明数据分析习惯，举例说明如何通过数据发现问题并驱动决策', w: 20 },
      { id: 'op9', cat: '项目管理', q: '你如何确保一个运营项目按时按质完成？', tips: '从目标拆解、进度管控、资源协调、风险预案等角度说明方法论', w: 20 },
      { id: 'op10', cat: '项目管理', q: '请分享一次你在项目中遇到困难并成功解决的经历', tips: '用STAR法则说明困难背景、分析过程、解决方案和最终结果', w: 20 },
      { id: 'op11', cat: '流程优化', q: '你如何优化运营流程，提升工作效率？', tips: '举例说明SOP建设、工具使用、自动化等具体优化措施和效果', w: 20 },
      { id: 'op12', cat: '流程优化', q: '你认为目前运营工作中最大的效率瓶颈是什么？你会如何解决？', tips: '结合具体业务场景分析瓶颈，提出系统性解决方案', w: 25 },
      { id: 'op13', cat: '内容运营', q: '你认为好的内容运营应该具备哪些能力？', tips: '从选题判断力、文案写作、数据分析、用户洞察等角度回答', w: 15 },
      { id: 'op14', cat: '内容运营', q: '如何提升内容的传播效果和用户互动率？', tips: '从标题优化、内容质量、发布时间、互动引导等角度说明方法', w: 20 },
      { id: 'op15', cat: '产品运营', q: '你认为用户运营和产品运营有什么区别？', tips: '用户运营围绕"人"，产品运营围绕"功能"，说明两者的交叉和差异', w: 20 },
      { id: 'op16', cat: '产品运营', q: '你有迭代过什么功能吗？具体怎么做的？', tips: '说明需求收集、问题洞察、方案设计、效果验证的完整过程', w: 20 },
      { id: 'op17', cat: '产品运营', q: '你如何通过运营手段提升产品的转化率？', tips: '从用户认知、兴趣激发、行动引导、体验优化等转化漏斗环节回答', w: 25 },
      { id: 'op18', cat: '产品运营', q: '你觉得你有什么不足？如何改进？', tips: '给出真实的、跟岗位相关的成长空间，说明具体的改进计划', w: 15 },
    ],

    // ══════ 10. 财务与审计 ══════
    finance: [
      { id: 'fn1', cat: '财务基础', q: '请谈谈三大财务报表（资产负债表、利润表、现金流量表）的勾稽关系', tips: '资产负债表的未分配利润期末减期初=利润表的净利润，现金流量表补充资料中净利润调回经营活动现金流', w: 15 },
      { id: 'fn2', cat: '会计核算', q: '手机零售业务在会计科目中如何展现，请说出具体的借贷分录', tips: '钱货两清：借货币资金科目贷主营业务收入；赊销则借方换为应收账款', w: 20 },
      { id: 'fn3', cat: '税务筹划', q: '业务招待费和业务宣传费的税前扣除比例分别是多少？如何通过合理筹划降低税负？', tips: '业务招待费按发生额60%与收入5‰孰低扣除；业务宣传费不超过收入15%。可通过将招待费转化为宣传费提高扣除额度', w: 20 },
      { id: 'fn4', cat: '成本管理', q: '牧原股份业务涉及养殖、加工等多个环节，你对不同业务板块财务核算重点的理解是什么？', tips: '养殖板块关注生物资产核算与减值；加工板块关注存货成本与毛利率；重点是成本归集与分配方法的差异', w: 25 },
      { id: 'fn5', cat: '财务分析', q: '如果某事业部年度销售费用执行偏差（已用率超预算10%），你会按怎样的思路排查原因？', tips: '三步法：1)拆分费用类型定位超支科目 2)对比业务量变化判断合理性 3)逐项审查费用标准执行情况', w: 25 },
      { id: 'fn6', cat: '内部控制', q: '你在过往工作中采取过哪些有效的成本控制措施，效果如何？', tips: '结合STAR法则：描述具体情境、采取的措施、量化的成本节约成果', w: 20 },
      { id: 'fn7', cat: '新会计准则', q: '谈谈你对新会计准则在企业财务会计工作中应用的理解和应对方法', tips: '关注收入确认（五步法）、租赁准则（使用权资产）、金融工具分类等重大变化及其对报表的影响', w: 25 },
      { id: 'fn8', cat: '财务合规', q: '如何确保财务数据的准确性和及时性？请举例说明', tips: '建立三道防线：日常复核、月度对账、季度审计；举例说明具体的差错发现与纠正过程', w: 20 },
      { id: 'fn9', cat: '税务实务', q: '请描述你独立完成企业所得税汇算清缴的流程和重点', tips: '流程：收入确认→纳税调整（招待费、广告费等）→税收优惠适用→申报表填写→附送资料准备', w: 20 },
      { id: 'fn10', cat: '财务BP', q: '如何运用数据分析为企业财务决策提供支持？', tips: '举例说明如何通过费用分析、预算偏差分析、ROI测算等支持业务决策，强调从数据到洞察的闭环', w: 25 },
      { id: 'fn11', cat: '资产管理', q: '固定资产折旧采用的方法有哪些？什么情况下账面价值会出现负值？', tips: '直线法（平均年限法、工作量法）和加速折旧法（双倍余额递减法、年数总和法）。账面价值不应出现负值，准则不允许负资产存在', w: 15 },
      { id: 'fn12', cat: '预算管理', q: '你在预算编制和控制方面有哪些经验？如何处理预算超支？', tips: '描述预算编制方法（零基/滚动）、执行监控机制、偏差分析与纠偏措施', w: 20 },
      { id: 'fn13', cat: '税务风险', q: '如果税务局系统发出风险预警提示公司某项指标异常，你该怎么办？', tips: '1)自查核实导出明细账 2)准备合同发票等四流合证证据链 3)主动联系税务专管员沟通 4)整改复盘完善内控', w: 25 },
      { id: 'fn14', cat: '财务信息化', q: '用友和金蝶财务软件你更倾向于哪一款？为什么？', tips: '根据实际使用经验回答，说明功能特点、操作体验、适用场景的差异', w: 15 },
      { id: 'fn15', cat: '财务规划', q: '你最近5年的职业规划是什么？如何与本岗位结合？', tips: '分阶段规划：1-2年夯实基础、3-4年专精方向、第5年承担管理职责，与公司发展相结合', w: 15 },
      { id: 'fn16', cat: '跨部门协作', q: '财务工作需与多部门协作，你如何与其他部门有效沟通以推进财务工作？', tips: '用业务语言沟通、建立定期对账机制、制作可视化报表降低理解门槛', w: 20 },
      { id: 'fn17', cat: '报表分析', q: '常用的财务指标有哪些？请说明其含义和分析要点', tips: '偿债能力（流动比率、速动比率）、盈利能力（毛利率、净利率、ROE）、运营能力（应收周转率、存货周转率）', w: 15 },
      { id: 'fn18', cat: '审计实务', q: '你在审计过程中如何发现重大错报风险？请举例说明', tips: '从存货的存在性与完整性双向追查、收入确认的截止性测试、内控缺陷的整改建议等角度回答', w: 25 },
      { id: 'fn19', cat: '税务筹划', q: '老板希望降低税负让你做税务筹划，你会如何区分筹划与偷税的界限？', tips: '合规优先：利用高新技术企业15%税率、研发费用加计扣除等政策；优化架构需有真实商业目的', w: 25 },
      { id: 'fn20', cat: '离职原因', q: '你为什么要从上一家公司离职？', tips: '从自身发展角度回答：发展空间有限、职业规划调整等，避免抱怨前公司', w: 15 },
    ],

    // ══════ 11. 人力资源与行政 ══════
    hr_admin: [
      { id: 'hr1', cat: '招聘管理', q: '你了解的招聘渠道有哪些？你如何评估一个招聘渠道的有效性？', tips: '渠道包括BOSS直聘、猎聘、拉勾、内推、校招等。评估维度：单位获客成本、候选人质量（试用转正率）、时效、稳定性', w: 20 },
      { id: 'hr2', cat: 'HRBP', q: '请谈谈你对HRBP的理解，包括工作内容、所需能力、你具备的和你不具备的', tips: 'HRBP是业务伙伴，需要懂业务+懂HR。核心能力：组织诊断、人才管理、文化落地。坦诚说明自身优劣势', w: 20 },
      { id: 'hr3', cat: '员工关系', q: '描述一次你成功解决员工冲突的经历', tips: '用STAR法则：情境（两名员工因工作分配产生矛盾）、任务（调解冲突恢复合作）、行动（组织沟通会明确职责）、结果（协作效率提升15%）', w: 20 },
      { id: 'hr4', cat: '绩效管理', q: '如何设计有效的绩效考核体系？如何处理绩效考核中的争议情况？', tips: 'KPI设计要SMART原则，考核标准透明可量化。争议处理：先听员工陈述，对照数据事实，适时引入HRBP介入', w: 25 },
      { id: 'hr5', cat: '企业文化', q: '你怎么看待公司"以人为本"的理念？如何将其落地到HR工作中？', tips: '结合具体实践：员工关怀计划、培训发展体系、公平透明的晋升机制等', w: 15 },
      { id: 'hr6', cat: '抗压能力', q: '你的抗压能力如何？请举一个你在高压环境下完成工作的例子', tips: '描述具体高压情境、如何调整心态、采取的行动、最终成果。强调结果导向', w: 20 },
      { id: 'hr7', cat: '培训发展', q: '如何验证培训有效？请说明Kirkpatrick四级评估模型', tips: '反应层（满意度）、学习层（考试通过率）、行为层（工作行为改变）、结果层（业务指标提升）', w: 25 },
      { id: 'hr8', cat: '劳动法规', q: '劳动合同法中哪些关键条款是HR必须掌握的？', tips: '合同签订时限、试用期规定、解除条件与补偿标准、加班规定、竞业限制等核心条款', w: 20 },
      { id: 'hr9', cat: '人才管理', q: '如何在紧急HC下将到岗周期从45天缩短到25天？', tips: '重构漏斗SLA（简历24h筛选、面试48h安排）、临时猎头并行、面试日集中化、JD优化AB测', w: 25 },
      { id: 'hr10', cat: '沟通协调', q: '描述你在协作时遇到的沟通方面的困难，如何解决双方的不一致与冲突？', tips: '用STAR法则描述具体冲突情境、分析分歧原因、采取的沟通策略、达成的共识与结果', w: 20 },
      { id: 'hr11', cat: '薪酬福利', q: '如何平衡薪酬公平性与竞争力？面对加薪诉求的公平性争议怎么处理？', tips: '参考带宽位点、业绩证据、外部对标、预算约束。沟通分层：先认可贡献，再解释规则', w: 25 },
      { id: 'hr12', cat: '组织发展', q: '你认为人力资源在企业中的角色是什么？', tips: '从战略伙伴、变革推动者、员工代言人、行政专家四个角色阐述，结合实际案例', w: 15 },
      { id: 'hr13', cat: '危机处理', q: '如果公司要进行大规模裁员，你如何保障剩余员工士气？', tips: '透明沟通裁员原因与标准、提供心理支持与转岗机会、强化核心团队激励、重建组织信任', w: 25 },
      { id: 'hr14', cat: '数据驱动', q: '如何用人力成本数据指导招聘策略？', tips: '分析招聘周期、人均产出、人力成本率、绩效分布健康度等指标，用数据驱动决策', w: 20 },
      { id: 'hr15', cat: '离职管理', q: '如何降低员工流失率？你会采取哪些预防措施？', tips: '建立离职预警机制（关注敬业度下降信号）、定期一对一沟通、竞争力薪酬与职业发展通道', w: 20 },
      { id: 'hr16', cat: '价值观', q: '你认为自己是幸运的吗？你如何定义成功？', tips: '展示积极心态与价值观，将个人成功与公司价值相关联', w: 15 },
      { id: 'hr17', cat: '招聘策略', q: '如何把KPI从"过程导向"转为"结果导向"？', tips: '业务价值链回溯、北极星指标对齐、权重调整、季度回顾与偏差纠正', w: 25 },
      { id: 'hr18', cat: '职业规划', q: '你对未来的职业规划是怎样的？这个岗位在你的规划中处于什么位置？', tips: '展示清晰的职业路径认知，说明该岗位如何帮助你实现长期目标', w: 15 },
      { id: 'hr19', cat: '数字化HR', q: '你对数字化对HR行业的影响有什么看法？', tips: '谈论e-HR系统、AI面试、数据分析工具如何提升HR效率，让HR从事务性工作转向战略层面', w: 20 },
      { id: 'hr20', cat: '应急处理', q: '如果发现同级同事实施违规操作，你会怎么做？', tips: '遵循制度流程、收集证据、及时沟通与上报、维护公司利益与合规底线', w: 20 },
    ],

    // ══════ 12. 设计与创意 ══════
    design: [
      { id: 'ds1', cat: '产品思维', q: '你理解的产品思维是怎样的？设计如何服务于产品？', tips: '设计服务于产品目标，从用户体验几大要素解析设计目标和受众，设计目标决定策略，受众决定风格', w: 20 },
      { id: 'ds2', cat: '作品集', q: '请分析你作品集中最完整的一个项目，重点阐述设计思考和总结收获', tips: '按设计流程讲解：需求分析→用户调研→设计策略→方案产出→数据验证。讲清楚每个设计决策的原因', w: 25 },
      { id: 'ds3', cat: '设计流程', q: '你在公司负责的设计流程是怎样的？', tips: '完整流程：需求评审→竞品分析→用户研究→信息架构→交互原型→视觉设计→走查验收→数据复盘', w: 20 },
      { id: 'ds4', cat: '用户体验', q: 'ToB产品和ToC产品在设计时有什么不同？', tips: 'ToB注重效率、流程、数据展示；ToC注重情感化、个性化、沉浸感。B端关注任务完成率，C端关注留存与转化', w: 20 },
      { id: 'ds5', cat: '设计协作', q: '在设计过程中遇到业务需求冲突时，你如何处理？', tips: '及时沟通明确优先级、用数据支撑设计决策、建立问题库共享、寻找双赢方案', w: 20 },
      { id: 'ds6', cat: '竞品分析', q: '你主要参考的竞品是什么？你觉得我们的设计点和竞品的区别是什么？', tips: '选择直接竞品和间接竞品进行对比，分析设计策略差异背后的产品定位和用户群体差异', w: 20 },
      { id: 'ds7', cat: '设计价值', q: '如何体现设计产生的价值？能否用数据说明？', tips: '例如：通过改版新用户增加10%、点击率提升30%、成交转化率提升15%，用数据量化设计成果', w: 25 },
      { id: 'ds8', cat: '专业能力', q: '你对iconfont的了解程度如何？简单说下Material Design', tips: 'iconfont考察与技术协作能力；Material Design考察设计知识面广度，包括色彩、排版、动效等规范', w: 20 },
      { id: 'ds9', cat: '交互设计', q: '移动端、pad端、桌面端之间的交互有什么不同？', tips: '操作方式（触控vs鼠标）、屏幕空间利用、信息密度、手势交互差异、响应式布局策略', w: 25 },
      { id: 'ds10', cat: '设计系统', q: '你是否参与过设计规范或组件库的搭建？具体做了什么？', tips: '描述规范制定过程：设计原则提炼→组件拆分→原子设计→规范文档→团队推广与维护', w: 25 },
      { id: 'ds11', cat: '自驱力', q: '工作中你是如何做到自驱的？', tips: '展示主动学习、关注行业趋势、持续输出设计分享、自我复盘改进的习惯', w: 15 },
      { id: 'ds12', cat: '解决问题', q: '举例说明你在公司实际解决的一个设计问题', tips: '用STAR法则：描述具体设计挑战、分析过程、解决方案、上线效果验证', w: 25 },
      { id: 'ds13', cat: '设计趋势', q: '你认为当前设计领域有哪些重要趋势？', tips: 'AI辅助设计、设计系统标准化、无障碍设计、暗色模式、微交互、3D元素等前沿趋势', w: 20 },
      { id: 'ds14', cat: '工具技能', q: '你常用的原型和设计工具有哪些？是否会前端代码？', tips: 'Figma/Sketch/Adobe XD等原型工具，AE/Principle动效工具，了解HTML/CSS是加分项', w: 15 },
      { id: 'ds15', cat: '设计管理', q: '你有团队管理经验吗？如何进行岗位定责和项目拆分？', tips: '描述团队规模、分工方式、设计评审机制、质量把控方法、团队成员培养计划', w: 25 },
      { id: 'ds16', cat: '职业规划', q: '期望自己3年后成为一个怎样的设计师？', tips: '展示成长路径：从执行层到策略层，从单点能力到全链路能力，从个人贡献到团队赋能', w: 15 },
      { id: 'ds17', cat: '设计思维', q: '你觉得一个好的交互设计师应该是什么样子的？', tips: '具备用户同理心、系统思维、商业敏感度、沟通协作能力，能从问题本质出发定义设计方案', w: 20 },
      { id: 'ds18', cat: '项目展示', q: '你在项目中的角色定位是什么？对项目的贡献度如何？', tips: '明确个人职责边界，说明在需求理解、方案设计、落地执行各环节的具体贡献', w: 20 },
      { id: 'ds19', cat: 'AI认知', q: '你对大语言模型和自然语言交互的认识是什么？GPT未来会给设计工作带来怎样的改变？', tips: 'AI辅助设计效率提升、自动化生成、个性化体验，设计师角色转向策略定义与创意把控', w: 25 },
      { id: 'ds20', cat: '离职原因', q: '为什么从上一家公司离职？空窗期在做什么？', tips: '坦诚回答离职原因，空窗期展示自我提升：学习新工具、研究设计趋势、个人项目实践', w: 15 },
    ],

    // ══════ 13. 数据与分析 ══════
    data_analytics: [
      { id: 'da1', cat: 'SQL能力', q: '请写出求各学科每个月新增用户量的SQL语句', tips: '使用窗口函数或子查询找到用户首次付费时间，再按月份和学科分组统计', w: 20 },
      { id: 'da2', cat: 'AB测试', q: 'A/B测试的流程是怎样的？如果结果不显著怎么办？', tips: '流程：假设→分组→实验→分析→决策。不显著时检查样本量、实验时长、指标选择是否合理', w: 25 },
      { id: 'da3', cat: '指标体系', q: '假设五月份第四周某平台GMV出现整体下滑，你觉得可以怎么分析？', tips: '维度拆解：时间趋势、品类结构、渠道分布、用户画像；内外因分析：竞对、政策、产品变更', w: 25 },
      { id: 'da4', cat: '业务分析', q: '广告点击率下降怎么分析？', tips: '按漏斗拆解：曝光→点击→转化；分析流量质量、素材效果、投放策略、用户行为变化', w: 20 },
      { id: 'da5', cat: '统计学', q: '双边检验与单边检验有什么不同？什么情况下使用？', tips: '双侧检验关注差异是否存在，单侧检验关注特定方向差异。根据研究假设和业务场景选择', w: 20 },
      { id: 'da6', cat: '数据建模', q: '解释一下SVM的分类超平面是什么？', tips: 'SVM寻找最大间隔超平面将数据分为两类，支持向量是距离超平面最近的样本点', w: 25 },
      { id: 'da7', cat: '指标定义', q: '如何给完全不懂互联网的老师解释什么是指标什么是维度？', tips: '指标是衡量事物的标准（如销售额），维度是观察事物的角度（如地区、时间）', w: 20 },
      { id: 'da8', cat: '留存分析', q: '请写出计算四日留存率的SQL', tips: '使用WITH AS结构，关联用户首次登录表与后续登录表，计算特定天数后仍活跃的用户比例', w: 20 },
      { id: 'da9', cat: '异动分析', q: '发现某项指标出现异常波动，你的分析思路是什么？', tips: '先确认数据准确性，再按维度拆解（时间、地区、渠道、用户群），内外因对比分析', w: 25 },
      { id: 'da10', cat: '因果推断', q: '如何在没有AB实验的情况下评估某个策略的效果？', tips: 'PSM（倾向得分匹配）、DID（双重差分）、断点回归等准实验方法', w: 25 },
      { id: 'da11', cat: '商业思维', q: '你觉得数据分析的团队在公司里是什么角色？', tips: '定位为业务决策的支持者与驱动者，通过数据洞察赋能业务增长，而非单纯的取数工具人', w: 20 },
      { id: 'da12', cat: '数据可视化', q: '搭看板和报表时你的用图思路是什么？', tips: '根据数据关系选图：趋势用折线、对比用柱状、占比用饼图、分布用散点，突出核心指标', w: 15 },
      { id: 'da13', cat: '机器学习', q: '有监督学习模型好坏的评判指标有哪些？', tips: '分类：准确率、精确率、召回率、F1、AUC-ROC；回归：MSE、RMSE、MAE、R²', w: 20 },
      { id: 'da14', cat: '场景题', q: '滴滴随机抽取地点免单活动，活动结束后如何进行复盘？', tips: '从用户参与度、订单增量、成本效益、用户留存、长期价值等多维度评估活动效果', w: 25 },
      { id: 'da15', cat: '沟通能力', q: '如何从数据的角度说服业务方？', tips: '用业务语言沟通、数据可视化呈现、对比实验结果、量化ROI、提供可执行的建议', w: 20 },
      { id: 'da16', cat: '数据处理', q: '处理一组复杂数据（多表、多口径）时，你如何保证口径统一？', tips: '建立数据字典、定义统一的口径文档、数据清洗规则、多人交叉验证机制', w: 20 },
      { id: 'da17', cat: '概率题', q: '一个正常骰子，一个空骰子，同时抛出两个骰子使其加和是1-12的均匀分布，怎样给空骰子贴标签？', tips: '空骰子每个面贴的数字应该是0-5，配合正常骰子1-6实现均匀分布', w: 25 },
      { id: 'da18', cat: '行业认知', q: '你平时用什么APP？请对这个APP进行业务拆解', tips: '选择熟悉的APP，从商业模式、核心功能、用户增长、变现方式等维度进行结构化分析', w: 20 },
      { id: 'da19', cat: '数据埋点', q: '数据埋点有了解吗？除了点击还有其他类型吗？', tips: '曝光、点击、滑动、停留时长、页面路径等。支付类数据通常通过服务端日志记录而非埋点', w: 20 },
      { id: 'da20', cat: '职业规划', q: '为什么选择数据分析，为什么不做产品经理？', tips: '展示对数据分析的独特理解，说明数据驱动决策的价值，以及个人在逻辑思维和数据敏感度上的优势', w: 15 },
    ],

    // ══════ 5. 技术与工程 ══════
    technical: [
      { id: 'tc1', cat: '项目经验', q: '请介绍你最得意的项目，工作量有哪些？做成什么效果？', tips: '用STAR法则：明确项目背景、个人职责、技术难点、解决方案、量化成果', w: 20 },
      { id: 'tc2', cat: '项目协作', q: '多人协作是怎么实现的？加锁是怎么实现的？', tips: '描述版本管理（Git）、分支策略、代码评审流程、锁机制（乐观锁/悲观锁）的选择与实现', w: 20 },
      { id: 'tc3', cat: '技术深度', q: '单例模式了解吗？为什么要两次判断锁？两次判断分别有什么作用？', tips: '第一次判断避免不必要的同步，第二次判断防止多线程竞争。双重检查锁保证线程安全与性能', w: 25 },
      { id: 'tc4', cat: '系统设计', q: '如何设计分布式定时器？单实例挂了怎么处理？', tips: '主从架构、任务持久化、故障转移机制。主节点负责调度，从节点备用，通过心跳检测实现高可用', w: 25 },
      { id: 'tc5', cat: '性能优化', q: '你在项目中遇到的最困难的技术问题是什么？是如何解决的？', tips: '描述问题定位过程（日志分析、性能监控）、根因分析、解决方案设计与实施、效果验证', w: 25 },
      { id: 'tc6', cat: '架构思维', q: '模块是如何划分的？你是怎么理解模块划分的？', tips: '按业务领域拆分、高内聚低耦合原则、接口定义清晰、依赖关系单向', w: 20 },
      { id: 'tc7', cat: '问题解决', q: '在开发过程中遇到了难题怎么解决？', tips: '查文档→搜社区→问同事→做实验。展示系统化的问题排查思路和学习能力', w: 15 },
      { id: 'tc8', cat: '技术选型', q: '为什么考虑某个技术方案？有什么缺陷？怎么解决？', tips: '对比多种方案的优劣、结合业务场景做选择、说明已知缺陷的应对策略', w: 20 },
      { id: 'tc9', cat: '并发处理', q: '线程池的核心参数及其业务含义是什么？生产环境中参数可以改变吗？', tips: '核心线程数、最大线程数、队列、拒绝策略。生产环境可通过配置中心动态调整', w: 25 },
      { id: 'tc10', cat: '数据结构', q: '哈希表的构建过程是怎样的？多线程使用哈希表有什么问题？', tips: 'hash函数→桶定位→冲突解决（链地址/开放寻址）。多线程下需考虑扩容时的数据一致性问题', w: 20 },
      { id: 'tc11', cat: '产品思维', q: '一个产品的过程中可能会遇到什么问题？做产品需要注意什么？', tips: '需求变更、技术债务、进度风险、质量把控。需要平衡业务价值、技术可行性和用户体验', w: 15 },
      { id: 'tc12', cat: '团队协作', q: '如果遇到技术方案的分歧，比如你觉得方案A合适，领导觉得方案B合适，你应该如何去解决？', tips: '先充分理解对方方案的优势、用数据和案例论证自己的观点、寻求折中方案、服从最终决策', w: 20 },
      { id: 'tc13', cat: '职业规划', q: '后端工程师应具备哪些素质和能力？你的职业规划是什么？', tips: '扎实基础、系统设计、业务理解、沟通协作。规划要与公司发展路径匹配', w: 15 },
      { id: 'tc14', cat: '系统设计', q: '秒杀系统有什么问题？你会怎么设计？', tips: '库存超卖、高并发、数据一致性。方案：Redis预扣库存、接口限流、异步下单、分段锁', w: 25 },
      { id: 'tc15', cat: '学习能力', q: '最近有没有学习新的技术？通过什么渠道关注技术前沿？', tips: '技术博客、开源社区、技术会议、公众号、GitHub。展示持续学习的习惯和热情', w: 15 },
      { id: 'tc16', cat: '项目复盘', q: '对项目进行复盘，总结项目经验，提出改进建议及其作用', tips: '哪些做得好要保持、哪些做得不好要改进、沉淀可复用的方法论和工具', w: 20 },
      { id: 'tc17', cat: '场景设计', q: 'Top K问题怎么解决？堆排和快排适用情况分别是什么？', tips: '小数据量用快排partition，大数据量用堆维护K个元素。堆排适合实时流数据，快排适合静态数据', w: 25 },
      { id: 'tc18', cat: '数据库', q: 'MySQL为什么选用B+树做索引？如果换成二叉树行不行？', tips: 'B+树矮胖减少IO次数、叶子节点有序支持范围查询、非叶节点只存索引增大扇出。二叉树太深IO开销大', w: 20 },
      { id: 'tc19', cat: '沟通表达', q: '你在实习期间负责的工作和遇到的挑战是什么？', tips: '具体描述工作内容、遇到的技术或业务挑战、采取的解决措施、最终的成果和收获', w: 15 },
      { id: 'tc20', cat: '场景题', q: '青蛙跳河问题：有n个台阶，每个台阶有可能有1-4块石头，你可以一次跳1-4步，求最多能捡到几块石头？', tips: '动态规划：dp[i] = max(dp[i-1]+stone[i], dp[i-2]+stone[i], dp[i-3]+stone[i], dp[i-4]+stone[i])', w: 25 },
    ],

    // ══════ 24. 电商与新零售 ══════
    ecommerce_retail: [
      { id: 'ec1', cat: '电商运营', q: '请解释GMV、UV、转化率的含义及它们之间的关系', tips: 'GMV = UV × 转化率 × 客单价，用具体店铺数据举例说明', w: 15 },
      { id: 'ec2', cat: '电商运营', q: '店铺流量下降30%，你会如何排查原因？', tips: '从时间节点、流量来源拆分、关键词排名、竞品对比四个维度分析', w: 20 },
      { id: 'ec3', cat: '电商运营', q: '如何计算直通车ROI，多少算合格？', tips: 'ROI = 成交金额 ÷ 花费，标品≥3为合格，非标品≥2为合格', w: 20 },
      { id: 'ec4', cat: '电商运营', q: '你如何判断一个产品值不值得上架？', tips: '从市场容量、竞争强度、利润空间、差评分析、供应链稳定性五个维度评估', w: 20 },
      { id: 'ec5', cat: '直播运营', q: '一场美妆直播该怎么组品？', tips: '考虑产品特色卖点与受众契合度，注重展示方式和直播节奏把控', w: 20 },
      { id: 'ec6', cat: '直播运营', q: '一场直播后该从哪些角度分析数据？', tips: '点击量、转化率、互动量、GPM（千次观看成交额）、完播率等核心指标', w: 20 },
      { id: 'ec7', cat: '直播运营', q: '当直播的产品点击量远低于浏览量，可能是什么原因？', tips: '产品定位不准、直播内容不吸引人、推广手段不到位、受众对产品不感兴趣', w: 20 },
      { id: 'ec8', cat: '直播运营', q: '抖音千川投放和淘宝直通车有什么核心区别？', tips: '千川绑定抖音小店，内容分发逻辑不同，ROAS目标值建议从1.5起设', w: 25 },
      { id: 'ec9', cat: '店铺运营', q: '什么是DSR评分，如何影响店铺权重？', tips: '描述相符、服务态度、物流速度三项，低于行业均值0.1分触发降权', w: 15 },
      { id: 'ec10', cat: '活动策划', q: '如何规划一次双11活动？', tips: 'T-30天确定主推SKU和备货量，T-15天报名活动，T-7天预售预热，活动当天每2小时监控', w: 25 },
      { id: 'ec11', cat: '活动策划', q: '活动结束后GMV不达标，你如何复盘？', tips: '从流量层、转化层、产品层三个层面拆解，找到核心数据异常点给出改进措施', w: 20 },
      { id: 'ec12', cat: '平台运营', q: '拼多多和淘宝的选品逻辑有何不同？', tips: '拼多多依赖低价标签和销量权重，淘宝更看重品牌溢价和内容种草', w: 20 },
      { id: 'ec13', cat: '内容运营', q: '小红书种草内容需要注意哪些合规要求？', tips: '商业推广笔记必须添加广告标签，不得出现绝对化用语，合作需通过蒲公英平台', w: 15 },
      { id: 'ec14', cat: '电商运营', q: '刷单会有什么后果，你如何看待这个问题？', tips: '明确表示不会操作刷单，给出合规替代方案如参加平台活动、优化搜索关键词', w: 15 },
      { id: 'ec15', cat: '店铺运营', q: '你认为京东的商业模式与淘宝、拼多多在商品定位上有哪些差异？', tips: '京东自营+物流优势，淘宝平台模式，拼多多低价社交裂变', w: 20 },
      { id: 'ec16', cat: '直播运营', q: '你认为快手电商跟抖音电商有什么区别？', tips: '快手更注重私域和老铁文化，抖音更依赖算法推荐和公域流量', w: 20 },
      { id: 'ec17', cat: '店铺运营', q: '如果一个美妆产品在天猫、抖音、快手三个平台上销售，有什么不同？', tips: '天猫重搜索和品牌，抖音重内容和兴趣推荐，快手重社交信任和私域', w: 20 },
      { id: 'ec18', cat: '电商运营', q: '如何提升店铺转化率？', tips: '详情页优化、价格策略调整、客服话术升级，用STAR结构展示实际案例', w: 20 },
    ],

    // ══════ 26. 人工智能与前沿科技 ══════
    ai_tech: [
      { id: 'ai1', cat: '大模型', q: '如何规范LLM的回答？', tips: 'SFT微调、上下文学习（prompt中给例子）、涉及专业领域时使用RAG', w: 20 },
      { id: 'ai2', cat: '大模型', q: '请描述RAG的实现流程', tips: '分割文档→向量化→灌入向量数据库→query检索→设置距离阈值→给到大模型', w: 20 },
      { id: 'ai3', cat: '深度学习', q: 'Transformer中的自注意力机制是什么？', tips: 'token embedding与Wq/Wk/Wv相乘得Q/K/V，计算注意力系数后加权求和', w: 20 },
      { id: 'ai4', cat: '深度学习', q: 'Transformer中Q与K点乘后为什么要除以根号dk？', tips: '防止dk较大时softmax梯度消失，相当于正则化', w: 25 },
      { id: 'ai5', cat: '机器学习', q: 'SVM的基本原理是什么？如何处理多分类和高维问题？', tips: '最大化超平面与支持向量的margin，多分类用多个二分类SVM，高维用核函数升维', w: 20 },
      { id: 'ai6', cat: '大模型', q: '如何判断大模型训练是否收敛？从多个角度回答', tips: 'loss曲线、验证集指标、学习率调度、梯度norm变化，注意区分局部最优和全局最优', w: 25 },
      { id: 'ai7', cat: '大模型', q: 'SFT过程中如何判断是否过拟合？', tips: '观察训练loss持续下降但验证loss开始上升，监控困惑度等评估指标变化', w: 20 },
      { id: 'ai8', cat: '大模型', q: 'DPO和PPO的区别是什么？', tips: 'PPO需要训练奖励模型再优化，DPO直接从偏好数据优化策略模型', w: 25 },
      { id: 'ai9', cat: '大模型', q: '为什么大语言模型都采用decoder-only结构？', tips: '自回归生成适合语言任务，encoder-only更适合理解任务，decoder-only在生成任务更优', w: 25 },
      { id: 'ai10', cat: '深度学习', q: 'BatchNorm的原理和作用是什么？', tips: '对每个batch的特征做归一化，加速训练收敛，有正则化效果，缓解梯度消失', w: 20 },
      { id: 'ai11', cat: '深度学习', q: '过拟合是什么意思，为什么会出现？如何缓解？', tips: '模型在训练集表现好但泛化差，原因包括数据不足、模型过复杂，可用Dropout/L1L2正则化/数据增强', w: 20 },
      { id: 'ai12', cat: '深度学习', q: 'Dropout会让神经元随机失效吗？模型确定后Dropout还会随机吗？', tips: '训练时随机失效起正则化作用，推理时所有神经元都激活，Dropout关闭', w: 20 },
      { id: 'ai13', cat: '大模型', q: '位置编码技术有哪些？RoPE的原理是什么？', tips: '绝对位置编码、相对位置编码、RoPE（旋转位置编码），RoPE将位置信息编码为旋转角度', w: 25 },
      { id: 'ai14', cat: '大模型', q: '长文本扩展技术有哪些？如何保证扩展后的效果？', tips: 'NTK、YaRN、ALiBi等位置内插方法，通过评测验证长度扩展后的性能保持', w: 25 },
      { id: 'ai15', cat: '机器学习', q: 'L1和L2正则化是如何缓解过拟合的？', tips: 'L1产生稀疏解实现特征选择，L2使权重趋向于小值，两者都限制模型复杂度', w: 20 },
      { id: 'ai16', cat: '机器学习', q: '为什么随机森林能处理高维数据？如何判断每个节点的优劣？', tips: '通过特征子集随机选择降低维度，用基尼系数或信息增益评估节点分裂质量', w: 20 },
      { id: 'ai17', cat: '大模型', q: '构造SFT数据的细节有哪些？prompt模板怎么设计？', tips: '数据质量优于数量，模板包含指令、上下文、输出格式，注意数据多样性', w: 20 },
      { id: 'ai18', cat: '深度学习', q: '多层堆叠时如何避免梯度消失和梯度爆炸？', tips: '残差连接、合适的权重初始化、梯度裁剪、学习率warmup、归一化层', w: 25 },
    ],

    // ══════ 27. 银行与保险 ══════
    banking_insurance: [
      { id: 'bi1', cat: '银行柜员', q: '你认为中国工商银行的柜员岗位需要具备哪些基本素质？', tips: '诚实守信、服务意识、细致耐心、抗压能力、团队合作精神', w: 15 },
      { id: 'bi2', cat: '银行柜员', q: '在客户投诉时，你会采取怎样的处理流程？', tips: '先安抚情绪、确认问题、提出解决方案、事后跟进，确保客户满意和银行形象', w: 20 },
      { id: 'bi3', cat: '银行柜员', q: '如何确保在处理现金和敏感信息时的准确无误？', tips: '双人复核、系统校验、定期培训、建立错误追溯机制', w: 20 },
      { id: 'bi4', cat: '银行柜员', q: '当发现客户可能存在欺诈行为时，你将如何处理？', tips: '保持冷静、按程序上报、不打草惊蛇、配合安保和合规部门调查', w: 25 },
      { id: 'bi5', cat: '银行柜员', q: '你如何看待银行数字化转型及其对柜员工作的影响？', tips: '柜员将从操作型向顾问型转变，需提升数字化技能和综合金融服务能力', w: 20 },
      { id: 'bi6', cat: '银行柜员', q: '面对大量客户时，你会如何有效管理时间并保持服务质量？', tips: '优先级排序、标准化流程、灵活调度、保持专注力和耐心', w: 15 },
      { id: 'bi7', cat: '银行营销', q: '请谈谈你对我国金融市场的了解，以及中国工商银行在其中的地位。', tips: '工行是全球最大商业银行之一，介绍市场份额、国际化布局、数字化转型成果', w: 15 },
      { id: 'bi8', cat: '银行柜员', q: '遇到客户对银行服务或产品的投诉，你的处理流程是什么？', tips: '倾听→记录→道歉→调查→解决→回访→改进，注重过程中的沟通技巧', w: 20 },
      { id: 'bi9', cat: '银行合规', q: '对于银行的反洗钱政策，你了解多少？', tips: '了解KYC原则、大额交易报告、可疑交易报告、客户尽职调查要求', w: 25 },
      { id: 'bi10', cat: '银行营销', q: '在金融产品销售方面，你有哪些经验或策略？', tips: '了解客户需求、匹配风险偏好、提供专业建议、建立长期信任关系', w: 20 },
      { id: 'bi11', cat: '银行柜员', q: '如何看待银行业务中的风险管理和内控合规？', tips: '风险合规是银行生命线，柜员需严格遵守操作规程，发现异常及时上报', w: 20 },
      { id: 'bi12', cat: '保险代理', q: '你对宁波银行保险产品的理解，如何向客户有效介绍？', tips: '了解产品特点、匹配客户需求、用通俗语言解释条款、强调保障价值', w: 20 },
      { id: 'bi13', cat: '保险代理', q: '面对客户对保险产品的疑虑和拒绝，你通常采取哪些措施？', tips: '先倾听客户顾虑、针对性解答、用案例说明、提供对比方案而非强行推销', w: 20 },
      { id: 'bi14', cat: '保险代理', q: '如何评估潜在客户的需求并推荐合适的保险方案？', tips: '了解家庭结构、收入水平、已有保障、风险偏好，量身定制保障组合', w: 25 },
      { id: 'bi15', cat: '银行面试', q: '你对加班的接受度如何？', tips: '表达愿意在关键节点配合加班，同时强调日常提高工作效率的意识', w: 15 },
      { id: 'bi16', cat: '银行柜员', q: '如何快速适应银行业务更新和政策变化？', tips: '主动参加培训、关注监管动态、向同事学习、建立个人知识管理体系', w: 15 },
      { id: 'bi17', cat: '银行合规', q: '你认为银行柜员在防范金融诈骗中应扮演什么角色？', tips: '提高识别能力、及时发现异常交易、提醒客户风险、配合反欺诈工作', w: 20 },
      { id: 'bi18', cat: '保险代理', q: '当客户提出的保险需求超出你的产品范围时，你如何处理？', tips: '坦诚告知、推荐合适替代方案、协调其他部门支持、保持客户信任', w: 20 },
    ],

    // ══════ 28. 物流与供应链 ══════
    logistics: [
      { id: 'lg1', cat: '仓储管理', q: '请阐述仓储管理中ABC分类法的核心逻辑及应用要点', tips: '基于帕累托法则，A类高价值需严格管控高频盘点，C类低价值可简化管理', w: 20 },
      { id: 'lg2', cat: '仓储管理', q: '先进先出（FIFO）原则在冷链仓储中的特殊实施要点是什么？', tips: '温度敏感性管理、批次精细化、保质期动态调整优先级，防止后进先出', w: 25 },
      { id: 'lg3', cat: '仓储管理', q: '库存周转率的标准计算公式是什么？如何提升？', tips: '销售成本/平均库存余额，通过优化补货策略、减少滞销库存、提高出库效率提升', w: 20 },
      { id: 'lg4', cat: '仓储管理', q: '数字化仓储管理系统（WMS）的核心功能有哪些？', tips: '库存实时预警、出入库扫码核销、库位智能分配，注意区分TMS运输管理系统', w: 20 },
      { id: 'lg5', cat: '供应链管理', q: '某仓库日均入库量12000件，如何计算所需托盘位数量？', tips: '根据体积、堆码层数、周转率要求进行计算，需掌握仓储容量规划公式', w: 25 },
      { id: 'lg6', cat: '仓储管理', q: '当仓库出现SKU数量激增导致库位不足时，你如何优化？', tips: 'ABC分类+标签化处理、D类滞销品清仓、动态调整库位布局、引入自动化设备', w: 25 },
      { id: 'lg7', cat: '仓储管理', q: '仓储区域发生初起火灾时，第一时间应采取什么措施？', tips: '切断区域电源→报警→扑救初起火灾→组织疏散，四懂四会是必备技能', w: 15 },
      { id: 'lg8', cat: '仓储管理', q: '拣货错误率从0.3%上升至0.8%，你会采取哪些措施降低？', tips: '新员工培训强化、系统波次单优化、高位区操作改进、过程监控双检点', w: 20 },
      { id: 'lg9', cat: '物流配送', q: '如何进行仓库选址？重心法如何计算？', tips: '综合考虑交通、成本、客户分布、政策环境、土地价格，用加权重心法计算初始坐标', w: 25 },
      { id: 'lg10', cat: '供应链管理', q: '牛鞭效应是如何产生的？如何缓解？', tips: '需求预测偏差、信息延迟、批量订货导致，通过信息共享、VMI、缩短提前期缓解', w: 20 },
      { id: 'lg11', cat: '仓储管理', q: '如何确保仓库存储的货物符合保质期和存储条件要求？', tips: '批次管理、先进先出、效期预警、定期盘点、环境监控（温湿度记录）', w: 20 },
      { id: 'lg12', cat: '物流配送', q: '绿色物流的要求有哪些？如何在仓储环节践行？', tips: '可循环包装、LED节能灯具、电动AGV、电子面单、减少空驶率', w: 20 },
      { id: 'lg13', cat: '仓储管理', q: '某3PL仓库高峰时段入库效率下降35%，你会如何系统性解决？', tips: '前端供应商分时段送货、资源动态调配、系统问题根治（条码/SKU同步）、效果验证', w: 25 },
      { id: 'lg14', cat: '供应链管理', q: '当面临仓库空间不足需要临时调整存储方案时，你会怎么做？', tips: '评估货物特性、临时外租仓库、调整存储密度、优先保障高周转品库位', w: 20 },
      { id: 'lg15', cat: '仓储管理', q: '如何在仓管工作中运用数据分析来优化工作流程？', tips: '分析库存周转率、拣货效率、错误率等指标，用数据驱动流程改进决策', w: 20 },
      { id: 'lg16', cat: '仓储管理', q: '国企仓储物资出库必须遵循的核心原则是什么？', tips: '先进先出，需执行最严格的管控标准，审批流程完整，严禁无凭证出库', w: 15 },
      { id: 'lg17', cat: '物流配送', q: '水路运输相比公路运输有哪些优势？', tips: '单位能耗约为公路的1/8，适合大宗低价值货物长距离运输，成本最低', w: 15 },
      { id: 'lg18', cat: '供应链管理', q: '什么是越库配送（Cross-Docking）？适合什么场景？', tips: '货物从收货区直接到发货区不入仓储环节，适合大促期间高周转商品快速处理', w: 20 },
    ],

    // ══════ 29. 医药与医疗器械 ══════
    pharma_med: [
      { id: 'pm1', cat: '医药代表', q: '如果这个市场交给你，你打算怎么做？', tips: '先维护现有销量→分析未开发医院分类→找关键人建立关系→逐步覆盖盲点', w: 25 },
      { id: 'pm2', cat: '医药代表', q: '你是如何做开发和产品上量工作的？', tips: '开发：分析医院类型→找关键人→建立关系→药事会前达成共识；上量：学术营销+策略结合', w: 25 },
      { id: 'pm3', cat: '医药代表', q: '医药代表在推广药品时应遵循的原则是什么？', tips: '如实介绍药品疗效、不良反应、用法用量，不得夸大疗效或隐瞒风险', w: 15 },
      { id: 'pm4', cat: '医药代表', q: '医生对产品存在疑虑，你会通过哪些专业知识去化解？', tips: '引用临床数据、指南推荐、文献支持，提供专业培训和学术支持', w: 20 },
      { id: 'pm5', cat: '医药代表', q: '如何向客户有效传达创新药物的独特优势与价值？', tips: '突出临床获益、安全性数据、差异化定位，结合目标患者群体特征精准传递', w: 20 },
      { id: 'pm6', cat: '医药代表', q: '当面临多个医药代表竞争同一大型医院客户时，你有什么竞争策略？', tips: '差异化服务、学术价值传递、建立深度信任、提供增值服务而非单纯客情', w: 20 },
      { id: 'pm7', cat: '医药合规', q: '老板当众批评了你，你是如何做的？', tips: '先倾听不打断→承认错误→提出解决方案→事后沟通→分享改进体会，用STAR案例说明', w: 20 },
      { id: 'pm8', cat: '医疗器械', q: '医疗器械销售与药品销售的主要区别是什么？', tips: '技术含量更高、决策流程更长、需要更强的专业知识支持和售后服务', w: 20 },
      { id: 'pm9', cat: '医疗器械', q: '某医院采购负责人明确表示对竞品更感兴趣，你会如何应对？', tips: '询问竞品选择原因→结合自身优势提供差异化方案→保持关系为后续留机会', w: 20 },
      { id: 'pm10', cat: '医药代表', q: '谈谈你对当前医药市场动态的理解，以及对医药代表工作的影响', tips: '集采政策、带量采购、合规趋严、学术推广转型、数字化营销趋势', w: 20 },
      { id: 'pm11', cat: '医药代表', q: '如何利用数据分析来优化推广策略？', tips: '分析处方量变化、科室需求、竞品动态，用数据指导拜访频率和推广重点', w: 20 },
      { id: 'pm12', cat: '医药代表', q: '若负责新区域市场，你如何快速打开销售局面？', tips: '市场调研→客户分级→制定拜访计划→组织学术活动→建立关键人网络→持续跟进', w: 25 },
      { id: 'pm13', cat: '医药合规', q: '你对医药代表职业操守和道德规范的理解是什么？', tips: '合规推广、不向医生行贿、保护患者隐私、不虚假宣传、遵守行业准则', w: 15 },
      { id: 'pm14', cat: '医疗器械', q: '如何理解医疗器械的合规性？', tips: '产品注册证、临床试验数据、使用说明书符合法规，配合监管部门飞行检查', w: 20 },
      { id: 'pm15', cat: '医药代表', q: '当客户对药品价格提出异议时，你会采取什么沟通策略？', tips: '解释产品性价比、对比竞品、提供临床价值分析、建议分期或联合采购方案', w: 20 },
      { id: 'pm16', cat: '医药代表', q: '如何快速掌握新产品的专业知识？', tips: '研读产品说明书和临床文献→参加公司培训→请教专家→模拟推广练习', w: 15 },
      { id: 'pm17', cat: '医疗器械', q: '客户对医疗器械产品的质量和售后提出担忧，你如何消除顾虑？', tips: '提供产品认证文件、展示成功案例、详细介绍售后服务体系、提供试用机会', w: 20 },
      { id: 'pm18', cat: '医药代表', q: '如何与医院内部不同科室的医护人员建立有效沟通渠道？', tips: '了解科室特点→定制化学术内容→定期拜访→组织科室会→持续跟进反馈', w: 20 },
    ],

    // ══════ 30. 文化与传媒 ══════
    culture_media: [
      { id: 'cm1', cat: '内容创作', q: '你认为新媒体运营必备的核心能力有哪些？', tips: '围绕文案撰写、数据分析、选题策划、用户洞察、活动策划等能力展开，结合实际案例', w: 15 },
      { id: 'cm2', cat: '内容创作', q: '给你一个新账号，你如何从0到1搭建运营体系？', tips: '从账号定位、用户调研、内容规划、渠道选择、数据复盘四个维度回答，体现系统思维', w: 20 },
      { id: 'cm3', cat: '新媒体运营', q: '你了解哪些主流新媒体平台？各平台的特性有什么区别？', tips: '分图文类（公众号、小红书、知乎）、视频类（抖音、B站、快手）分别阐述，重点讲平台规则和用户画像差异', w: 15 },
      { id: 'cm4', cat: '新媒体运营', q: '谈谈你之前运营过的账号，数据表现如何？', tips: '用STAR法则，说明账号定位、目标用户、内容策略、具体数据（涨粉、阅读量、互动率）和复盘优化', w: 20 },
      { id: 'cm5', cat: 'MCN运营', q: '你如何理解MCN机构的商业模式和运营逻辑？', tips: '从内容孵化、达人管理、品牌商务、流量变现四个环节回答，了解MCN与品牌方、平台的关系', w: 20 },
      { id: 'cm6', cat: 'MCN运营', q: '如果让你负责一个达人账号的孵化，你会怎么做？', tips: '从人设定位、内容规划、粉丝运营、商业变现路径四方面展开，举例说明成功案例', w: 25 },
      { id: 'cm7', cat: '内容策划', q: '你如何策划一场能引爆传播的线上活动？', tips: '从话题选择、内容形式、传播渠道、互动机制、数据监控五个维度分析，结合热点事件举例', w: 25 },
      { id: 'cm8', cat: '内容策划', q: '说说近期的一个热点话题，如果结合我们品牌你会怎么做内容？', tips: '展示热点敏感度，分析热点与品牌的契合点，提出具体的内容策划方案', w: 20 },
      { id: 'cm9', cat: '数据分析', q: '你如何通过数据分析来优化内容策略？', tips: '说明关注的核心指标（阅读量、完播率、互动率、转化率），如何通过数据发现问题并迭代', w: 20 },
      { id: 'cm10', cat: '内容创作', q: '短视频和图文内容在创作思路上有什么本质区别？', tips: '从用户注意力、信息密度、创作门槛、传播机制、变现模式五个角度对比分析', w: 20 },
      { id: 'cm11', cat: '品牌传播', q: '你如何看待短视频平台的品牌营销趋势？', tips: '结合抖音、快手等平台的品牌广告形式（信息流、挑战赛、达人合作等）分析', w: 20 },
      { id: 'cm12', cat: '内容创作', q: '你认为什么样的内容能持续获得用户关注？', tips: '从价值感、情绪共鸣、差异化、持续性四个维度回答，举例说明', w: 15 },
      { id: 'cm13', cat: 'MCN运营', q: '如何处理达人与MCN之间的利益冲突？', tips: '从合同约定、分成机制、资源支持、沟通协调四个方面回答，体现管理思维', w: 25 },
    ],

    // ══════ 31. 建筑与房地产 ══════
    construction_re: [
      { id: 'cr1', cat: '工程管理', q: '你对工程项目管理是怎么理解的？最关键的环节有哪些？', tips: '从三控三管一安全的角度回答：进度、质量、成本控制，安全、合同、信息管理，以及组织协调', w: 15 },
      { id: 'cr2', cat: '工程管理', q: '施工现场发现安全隐患，赶工期时你怎么处理？', tips: '必须明确安全第一的立场，说明立即停工整改，同时提出合理赶工方案', w: 20 },
      { id: 'cr3', cat: '施工技术', q: '基坑开裂了怎么办？请说明处理流程。', tips: '从应急处置、原因分析、方案制定、加固处理四个步骤回答，体现管理思维', w: 25 },
      { id: 'cr4', cat: '项目管理', q: '进度和质量经常是一对矛盾，你怎么在项目管理中平衡二者？', tips: '强调质量是不可逾越的底线，通过合理排程、样板引路、过程验收来平衡', w: 20 },
      { id: 'cr5', cat: '成本控制', q: '项目成本控制的关键节点有哪些？如何有效避免超预算？', tips: '从投标、施工准备、施工过程、采购、收尾五个阶段分析，提及签证变更管理', w: 25 },
      { id: 'cr6', cat: '安全管理', q: '你觉得建筑行业安全管理为什么特别重要？', tips: '从法律法规、企业声誉、人身安全三个层面阐述，体现对安全责任的认识', w: 15 },
      { id: 'cr7', cat: '工程技术', q: '你了解BIM技术吗？对智慧工地有什么看法？', tips: '说明BIM基本概念和应用场景，提物联网、AI识别、无人机等智慧工地技术', w: 20 },
      { id: 'cr8', cat: '项目管理', q: '作为项目管理者，怎么跟甲方、监理方、分包方有效沟通？', tips: '分对象回答：甲方用数据说话，监理尊重监督职能，分包严格管理与协助并重', w: 20 },
      { id: 'cr9', cat: '工程管理', q: '中建的项目遍布全国，你接受长期驻场和频繁出差吗？', tips: '态度干脆接受，说明了解行业特性，将基层经历视为成长机会', w: 15 },
      { id: 'cr10', cat: '施工技术', q: '请简述混凝土浇筑的施工要点和质量控制措施。', tips: '从配合比、浇筑顺序、振捣、养护等环节回答，体现专业知识', w: 20 },
      { id: 'cr11', cat: '合同管理', q: '工程签证变更如何管理？容易出现哪些问题？', tips: '说明签证变更的审批流程，常见问题如资料不全、时效性、计量争议等', w: 25 },
      { id: 'cr12', cat: '项目管理', q: '你认为房地产开发过程中最重要的是哪个阶段？', tips: '从前期策划、设计管理、施工管理、营销运营各阶段分析，说明各阶段关键控制点', w: 20 },
    ],

    // ══════ 32. 餐饮与酒店管理 ══════
    hospitality: [
      { id: 'ht1', cat: '酒店管理', q: '请简要介绍一下你自己，为什么选择酒店管理这个行业？', tips: '突出服务意识、沟通能力和行业热情，说明对酒店行业的理解', w: 15 },
      { id: 'ht2', cat: '酒店管理', q: '你认为一名优秀的酒店经理需要具备哪些素质？', tips: '从服务意识、管理能力、沟通协调、应变能力、团队建设五个方面回答', w: 15 },
      { id: 'ht3', cat: '餐饮管理', q: '如何控制餐饮成本？请结合实际经验谈谈。', tips: '从采购验收、库存管理、加工标准化、销售控制、能耗管理等环节说明', w: 20 },
      { id: 'ht4', cat: '前厅管理', q: '遇到客人投诉时，你会如何处理？请举一个你处理过的案例。', tips: '先安抚情绪、了解诉求、提出方案、跟进反馈，用具体案例说明', w: 20 },
      { id: 'ht5', cat: '酒店管理', q: '你如何看待酒店行业的淡旺季经营策略差异？', tips: '淡季做员工培训、设施维护、价格策略调整；旺季做好服务保障和收益管理', w: 20 },
      { id: 'ht6', cat: '餐饮管理', q: '如果餐厅出现食品安全事故，你会怎么处理？', tips: '立即停止售卖、救治顾客、报告上级、保留证据、配合调查、整改复盘', w: 25 },
      { id: 'ht7', cat: '宴会销售', q: '你如何开拓新的宴会和会议客户？', tips: '从市场分析、客户画像、渠道拓展、关系维护、方案定制五个方面回答', w: 20 },
      { id: 'ht8', cat: '团队管理', q: '酒店行业人员流动性大，你如何降低员工离职率？', tips: '从薪酬激励、职业发展、工作氛围、培训体系、人文关怀等方面回答', w: 20 },
      { id: 'ht9', cat: '前厅管理', q: '如何提升酒店的顾客满意度和复购率？', tips: '从服务标准化、个性化体验、会员体系、口碑管理、投诉处理五个维度回答', w: 20 },
      { id: 'ht10', cat: '酒店管理', q: '你对OTA平台的运营有什么了解？如何提升酒店在线评分？', tips: '了解携程、美团等平台的评分机制，从硬件设施、服务质量、照片展示、回复管理等方面回答', w: 20 },
      { id: 'ht11', cat: '餐饮管理', q: '如何设计一份既能盈利又能吸引顾客的菜单？', tips: '从菜品结构、定价策略、毛利分析、季节性调整、差异化定位等方面回答', w: 25 },
      { id: 'ht12', cat: '酒店管理', q: '如何看待酒店行业的数字化转型？', tips: '从智慧前台、自助入住、数据管理、智能客房、线上营销等角度分析', w: 20 },
    ],

    // ══════ 33. 农业与畜牧 ══════
    agriculture: [
      { id: 'ag1', cat: '农业技术', q: '请介绍一下你在农业种植或养殖方面的实际经验。', tips: '具体说明作物品种、种植规模、管理方法和取得的成果，体现专业背景', w: 15 },
      { id: 'ag2', cat: '农业技术', q: '农作物病虫害防治你有哪些方法和经验？', tips: '从物理防治、生物防治、化学防治三个角度回答，强调绿色防控理念', w: 20 },
      { id: 'ag3', cat: '农业项目管理', q: '如果让你负责一个农业合作社项目，你会怎么规划和管理？', tips: '从市场调研、品种选择、技术方案、成本预算、销售渠道五个方面回答', w: 25 },
      { id: 'ag4', cat: '农业技术', q: '你如何根据土壤情况科学施肥和灌溉？', tips: '说明土壤检测、配方施肥、节水灌溉技术，体现精准农业理念', w: 20 },
      { id: 'ag5', cat: '供应链管理', q: '农产品从田间到餐桌的供应链如何优化？', tips: '从采收标准、冷链物流、仓储管理、渠道建设、品牌化等方面回答', w: 25 },
      { id: 'ag6', cat: '农业技术', q: '你对智慧农业和农业物联网有什么了解？', tips: '了解传感器、无人机巡检、智能灌溉、数据平台等技术在农业中的应用', w: 20 },
      { id: 'ag7', cat: '畜牧业', q: '规模化养殖场如何做好疫病防控工作？', tips: '从免疫程序、环境管理、生物安全、监测预警四个方面回答', w: 20 },
      { id: 'ag8', cat: '农业项目管理', q: '农业项目投资周期长、风险大，你如何进行风险管理？', tips: '从自然风险、市场风险、技术风险、政策风险四个维度提出应对措施', w: 25 },
      { id: 'ag9', cat: '农业技术', q: '你认为当前中国农业面临的主要挑战是什么？如何解决？', tips: '从劳动力短缺、土地碎片化、技术落后、品牌化不足等方面分析', w: 20 },
      { id: 'ag10', cat: '农产品销售', q: '如何通过电商渠道销售农产品？你有哪些经验？', tips: '从平台选择、品牌包装、内容营销、物流配送、售后服务等方面回答', w: 20 },
      { id: 'ag11', cat: '农业技术', q: '有机农业和传统农业在管理上有哪些主要区别？', tips: '从投入品管理、土壤养护、认证体系、成本结构、市场定位等方面对比', w: 20 },
      { id: 'ag12', cat: '农业政策', q: '你对国家农业补贴政策和乡村振兴战略有什么了解？', tips: '了解农业保险、种植补贴、土地流转政策等，说明如何借助政策红利', w: 15 },
    ],

    // ══════ 25. 新能源与环保 ══════
    new_energy: [
      { id: 'ne1', cat: '光伏技术', q: '请解释一下光伏效应，以及光伏电池的工作原理是什么？', tips: '光伏效应指光子照射半导体时激发电子-空穴对产生电动势；需说明PN结内建电场驱动载流子分离形成电流。', w: 15 },
      { id: 'ne2', cat: '光伏技术', q: 'MPPT算法的作用和原理是什么？在实际光伏系统中如何应用？', tips: '最大功率点追踪；常用扰动观察法(P&O)和电导增量法(INC)；实时调整工作电压使光伏阵列始终输出最大功率。', w: 20 },
      { id: 'ne3', cat: '光伏技术', q: '请解释PID效应对光伏电池的影响，以及如何减少PID效应？', tips: '电位诱导衰减；高温高湿下漏电流导致功率衰减；可通过负极接地、使用抗PID组件、优化系统设计等措施降低。', w: 25 },
      { id: 'ne4', cat: '储能技术', q: '请解释功率型储能与能量型储能的区别及各自应用场景。', tips: '功率型侧重瞬时大功率输出（如飞轮、超级电容，用于调频）；能量型侧重长时间持续供电（如锂电、液流电池，用于调峰）。', w: 20 },
      { id: 'ne5', cat: '储能技术', q: '电池管理系统(BMS)在储能系统中的核心作用是什么？主要监测哪些参数？', tips: 'BMS负责电池状态估算(SOC/SOH)、均衡管理、热管理、过充过放保护；主要监测电压、电流、温度、内阻等参数。', w: 20 },
      { id: 'ne6', cat: '储能技术', q: '请比较锂电池和液流电池在储能系统中的优缺点。', tips: '锂电池能量密度高但循环寿命有限、有热失控风险；液流电池寿命长、安全性好但能量密度低、占地面积大、成本较高。', w: 25 },
      { id: 'ne7', cat: '新能源汽车', q: '请解释SOC(荷电状态)和SOH(健康状态)的估算方法，以及它们对BMS的重要性。', tips: 'SOC常用安时积分法+卡尔曼滤波融合估算；SOH通过容量衰减和内阻增长评估；SOC决定续航、SOH决定电池寿命管理策略。', w: 20 },
      { id: 'ne8', cat: '新能源汽车', q: '请描述电池热管理系统的设计要点，以及如何预防热失控？', tips: '需考虑散热路径设计、冷却液回路、温度传感器布置；预防措施包括热蔓延阻断设计、防爆阀、BMS主动断电逻辑触发条件。', w: 25 },
      { id: 'ne9', cat: '新能源汽车', q: '主动均衡和被动均衡技术有什么区别？在实际项目中如何选择？', tips: '被动均衡通过电阻放电耗散多余能量，成本低但效率低；主动均衡通过电容/电感转移能量，效率高但电路复杂；根据成本和精度要求权衡。', w: 20 },
      { id: 'ne10', cat: '碳管理', q: '请解释碳排放权、碳配额与CCER的区别，以及CCER的抵消规则。', tips: '碳配额是政府分配的排放额度；CCER是自愿减排项目产生的碳信用；CCER抵消比例通常不超过企业年度排放量的5%，且需近5年内产生。', w: 20 },
      { id: 'ne11', cat: '碳管理', q: '温室气体排放核算中Scope 1、Scope 2和Scope 3分别指什么？', tips: 'Scope 1是直接排放（如燃烧）；Scope 2是外购电力热力间接排放；Scope 3是上下游供应链间接排放（如运输、原材料）。', w: 15 },
      { id: 'ne12', cat: '充电桩运维', q: '直流充电桩与交流充电桩的核心区别是什么？充电过程中涉及哪些通信协议？', tips: '直流桩内置整流器直接输出直流电，功率大；交流桩通过车载充电机转换；通信协议主要采用GB/T 27930（国标），国际常用OCPP协议。', w: 20 },
      { id: 'ne13', cat: '充电桩运维', q: '充电桩在恶劣天气条件（雷雨、高温）下应采取哪些安全防护措施？', tips: '雷雨天需切断电源、检查接地系统、停止充电；高温天检查散热风扇和风道、监控功率模块温度、必要时降功率运行。', w: 15 },
      { id: 'ne14', cat: '风电技术', q: '请简述双馈异步发电机和直驱永磁发电机的核心区别及各自优缺点。', tips: '双馈有齿轮箱、部分功率变流器，成本低但齿轮箱维护多；直驱无齿轮箱、全功率变流器，可靠性高但体积大、稀土用量多。', w: 20 },
      { id: 'ne15', cat: '风电技术', q: '风力发电机组偏航系统的主要作用是什么？偏航异常可能导致哪些问题？', tips: '偏航系统使风机始终对准风向以获取最大风能；异常会导致发电效率下降、叶片受力不均、塔筒振动加剧甚至结构损坏。', w: 20 },
    ],

    // ══════ 14. 教育与培训 ══════
    education: [
      { id: 'ed1', cat: '教学能力', q: '你认为当好一个班主任需要具备哪些素质？', tips: '从教学能力、沟通能力、组织能力、责任心、公平公正等方面回答', w: 15 },
      { id: 'ed2', cat: '教学能力', q: '请谈谈你对"因材施教"的理解和实践。', tips: '说明如何根据学生个体差异调整教学方法，举例说明具体做法', w: 20 },
      { id: 'ed3', cat: '课堂管理', q: '课堂上有学生故意捣乱影响教学，你会怎么处理？', tips: '先冷静处理不影响教学，课后单独沟通了解原因，家校合作解决问题', w: 20 },
      { id: 'ed4', cat: '教学设计', q: '请简要说说你的教学理念和教学风格。', tips: '结合教育理论和个人实践经验，说明以学生为中心、互动式教学等理念', w: 15 },
      { id: 'ed5', cat: '家校沟通', q: '如何与家长有效沟通，处理家长的不满和投诉？', tips: '保持专业态度、倾听诉求、及时反馈、提供解决方案、建立信任关系', w: 20 },
      { id: 'ed6', cat: '教学能力', q: '你如何看待"双减"政策对教育教学的影响？', tips: '从提高课堂效率、优化作业设计、关注学生全面发展等方面回答', w: 20 },
      { id: 'ed7', cat: '教育心理', q: '面对学习困难的学生，你通常采取什么策略？', tips: '从诊断原因、分层教学、激发兴趣、建立自信、家校配合等方面回答', w: 20 },
      { id: 'ed8', cat: '专业发展', q: '你的职业规划是什么？未来3-5年有什么目标？', tips: '说明短期站稳讲台、中期形成教学特色、长期成为骨干教师的规划', w: 15 },
      { id: 'ed9', cat: '教学能力', q: '请谈谈你对核心素养教育的理解。', tips: '从学科核心素养、跨学科融合、综合实践活动等方面回答', w: 20 },
      { id: 'ed10', cat: '课堂管理', q: '如何让课堂既有纪律又有活力？', tips: '建立明确规则的同时采用多元化教学方法，让学生参与课堂互动', w: 20 },
      { id: 'ed11', cat: '教育技术', q: '你如何利用信息技术手段提升教学效果？', tips: '举例说明多媒体教学、在线平台、教育APP等工具的应用场景', w: 20 },
      { id: 'ed12', cat: '教学能力', q: '陶行知说"捧得一颗心来，不带半根草去"，请谈谈你对这句话的理解。', tips: '体现教师奉献精神，结合自身教育情怀和对教师职业的认识回答', w: 15 },
    ],

    // ══════ 15. 医疗健康 ══════
    healthcare: [
      { id: 'hc1', cat: '护理基础', q: '你为什么选择护士这个职业？', tips: '从职业认同、个人经历、服务患者的角度回答，体现对护理事业的热爱', w: 15 },
      { id: 'hc2', cat: '护理基础', q: '请谈谈无菌技术操作的基本原则和注意事项。', tips: '从环境准备、物品管理、操作规范、防止污染等角度回答，体现专业性', w: 20 },
      { id: 'hc3', cat: '临床护理', q: '遇到患者突然病情变化，你会怎么处理？', tips: '保持冷静、快速评估、执行医嘱、做好记录、及时沟通，体现应急能力', w: 25 },
      { id: 'hc4', cat: '护理管理', q: '你认为护理工作中最容易出现的差错有哪些？如何预防？', tips: '如用药错误、标本采集错误、交接班遗漏等，从制度和流程两方面回答', w: 20 },
      { id: 'hc5', cat: '护理伦理', q: '当患者或家属对治疗方案提出质疑时，你怎么处理？', tips: '耐心倾听、解释说明、安抚情绪、必要时请医生沟通、做好记录', w: 20 },
      { id: 'hc6', cat: '护理基础', q: '请简述输液过程中出现静脉炎的原因和处理方法。', tips: '从药液浓度、穿刺技术、无菌操作等方面分析原因，说明处理措施', w: 20 },
      { id: 'hc7', cat: '应急处理', q: '有一位中年女性服用敌敌畏自杀，你应该如何抢救？', tips: '从脱离毒物、洗胃导泻、解毒药物应用、生命体征监测等方面回答', w: 25 },
      { id: 'hc8', cat: '护理管理', q: '如何提升护理服务质量？你有什么建议？', tips: '从培训体系、流程优化、患者满意度、绩效考核、信息化建设等方面回答', w: 20 },
      { id: 'hc9', cat: '护理沟通', q: '面对临终患者，你会如何提供护理关怀？', tips: '从疼痛管理、心理支持、家属沟通、人文关怀等方面回答，体现同理心', w: 20 },
      { id: 'hc10', cat: '护理基础', q: '护理诊断公式中的P代表什么？请举例说明。', tips: 'P代表病人的健康问题，举例说明护理诊断的完整书写格式', w: 15 },
      { id: 'hc11', cat: '感染控制', q: '医院感染防控的关键措施有哪些？', tips: '从手卫生、隔离措施、消毒灭菌、医疗废物管理、监测报告等方面回答', w: 20 },
      { id: 'hc12', cat: '护理沟通', q: '慢性病呈上升趋势，作为护士你认为应该怎么做？', tips: '从健康教育、生活方式指导、随访管理、社区护理等方面回答', w: 20 },
    ],

    // ══════ 16. 法务与合规 ══════
    legal: [
      { id: 'lg1', cat: '法务基础', q: '请谈谈你对合规管理的理解，合规管理在企业中应该扮演什么角色？', tips: '从风险管理、制度建设、合规审查、培训教育等方面回答，强调预防为主', w: 15 },
      { id: 'lg2', cat: '合同管理', q: '拿到一份合同，你会怎么审查？主要关注哪些方面？', tips: '从主体资格、条款合法性、权利义务对等、违约责任、争议解决等方面回答', w: 20 },
      { id: 'lg3', cat: '法务基础', q: '你对法务和律师的关系怎么理解？为什么不选择做律师？', tips: '法务侧重企业内部风控和管理，律师侧重外部专业服务，回答时不要拉踩', w: 20 },
      { id: 'lg4', cat: '合规管理', q: '前台业务部门与后端合规部门出现矛盾时，你怎么处理？', tips: '以风险评估为基础进行协调，既要支持业务发展又要守住合规底线', w: 25 },
      { id: 'lg5', cat: '劳动法务', q: '请谈谈你对劳动争议处理的理解。', tips: '了解劳动法、劳动合同法相关规定，从协商、调解、仲裁、诉讼流程回答', w: 20 },
      { id: 'lg6', cat: '公司法务', q: '你对公司法务的工作内容了解多少？', tips: '围绕风控合规、合同管理、诉讼仲裁、法律顾问对接四大模块回答', w: 15 },
      { id: 'lg7', cat: '合规管理', q: '近期反垄断案件频发，这对企业法务工作带来哪些新挑战？', tips: '从法规学习、合规体系建设、风险评估、应对调查等方面回答', w: 25 },
      { id: 'lg8', cat: '知识产权', q: '互联网行业中常见的知识产权问题有哪些？', tips: '从商标侵权、著作权保护、专利纠纷、商业秘密等方面回答', w: 20 },
      { id: 'lg9', cat: '合同管理', q: '你如何处理一份标的额较大的商务合同谈判？', tips: '从前期调研、条款设计、风险识别、谈判策略、审批流程等方面回答', w: 25 },
      { id: 'lg10', cat: '法务基础', q: '你对公司业务有什么了解？（看你是否海投）', tips: '提前通过企查查、裁判文书网等了解公司业务和涉诉情况，体现用心', w: 15 },
      { id: 'lg11', cat: '合规管理', q: '你如何搭建企业的合规管理体系？', tips: '从合规政策制定、风险评估、培训体系、监控机制、整改追责等环节回答', w: 25 },
      { id: 'lg12', cat: '诉讼仲裁', q: '你处理过印象最深的案件或法律事务是什么？', tips: '用STAR法则，说明背景、任务、行动和结果，突出个人参与度和收获', w: 20 },
      { id: 'lg13', cat: '法务基础', q: '为什么不去考公务员？', tips: '从职业发展、工作内容匹配度、个人追求等方面回答，不要贬低公务员', w: 15 },
    ],

  };;

  // ── 题目难度分级系统 ──
  // 基础：w<=15, 通用题目或简单场景
  // 中级：w=20, 需要具体案例和反思
  // 高级：w>=25, 复杂场景、领导力、战略思维
  const DIFFICULTY_LEVELS = { basic: '基础', intermediate: '中级', advanced: '高级' };

  function classifyDifficulty(q) {
    if (!q) return 'basic';
    if (q.w >= 25) return 'advanced';
    if (q.w >= 20) return 'intermediate';
    return 'basic';
  }

  // 为所有题目添加难度标签
  for (const category of Object.values(INTERVIEW_DB)) {
    for (const q of category) {
      q.difficulty = classifyDifficulty(q);
    }
  }

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

  // ═══════════════════════════════════════════════════
  //  面试流程框架 v2.0（动态自适应）
  // ═══════════════════════════════════════════════════

  // 面试阶段定义
  const INTERVIEW_PHASES = {
    warmup:     { label: '暖场', maxRounds: 1 },
    background: { label: '背景', maxRounds: 2 },
    ability:    { label: '能力', maxRounds: 4 },
    behavior:   { label: '行为', maxRounds: 3 },
    depth:      { label: '深度', maxRounds: 3 },
    closing:    { label: '收尾', maxRounds: 2 },
  };

  // 关键词提取：从回答中识别候选人提到的内容
  const KEYWORD_PATTERNS = {
    project:   /项目|产品|功能|上线|发布|迭代|重构|迁移/gi,
    team:      /团队|小组|部门|同事|协作|配合|跨部门/gi,
    data:      /数据|指标|转化|增长|留存|DAU|GMV|ROI|KPI|OKR/gi,
    conflict:  /冲突|分歧|矛盾|争议|反对|不同意/gi,
    pressure:  /加班|紧急|deadline|高压|强度|熬夜|通宵/gi,
    learning:  /学习|培训|课程|认证|自学|看书|研究/gi,
    failure:   /失败|错误|踩坑|复盘|教训|没做好/gi,
    customer:  /客户|用户|反馈|投诉|需求|满意度/gi,
    tech:      /技术|架构|系统|性能|优化|算法|代码/gi,
    leadership:/管理|带人|负责|主导|推动|决策/gi,
  };

  // 根据关键词生成追问模板
  const FOLLOWUP_TEMPLATES = {
    project: [
      '你提到的这个项目，当时团队有多少人？你在其中具体负责哪一块？',
      '这个项目最终的成果如何？有没有可以量化的数据？',
      '项目过程中遇到的最大挑战是什么？你是怎么解决的？',
    ],
    team: [
      '能具体说说你是怎么和团队协作的吗？举个例子？',
      '团队内部有没有出现过分歧？你是怎么处理的？',
      '你觉得在一个团队中，最重要的是什么？',
    ],
    data: [
      '你提到的这个数据指标，优化前后的具体变化是多少？',
      '你是通过什么方法提升这个指标的？能拆解一下步骤吗？',
      '这个数据结果得到了谁的认可？后来有没有持续保持？',
    ],
    conflict: [
      '当时具体是什么分歧？对方的立场是什么？',
      '你最终是怎么说服对方的？用了什么策略？',
      '这件事之后，你们的合作关系有什么变化吗？',
    ],
    pressure: [
      '能描述一下当时具体的高压场景吗？',
      '你是怎么调节自己的状态的？有没有什么方法？',
      '在那种压力下，你是怎么保证工作质量的？',
    ],
    learning: [
      '你最近学的这个东西，对你的工作有什么具体帮助？',
      '你是怎么安排时间学习的？有没有什么学习方法分享？',
      '学完之后有没有实际应用到工作中？效果如何？',
    ],
    failure: [
      '能具体说说当时是什么情况？',
      '事后你做了什么来避免类似问题再次发生？',
      '这件事对你后来的工作方式有什么影响？',
    ],
    customer: [
      '能举一个具体的例子吗？当时的场景是什么？',
      '你是怎么判断客户的真实需求的？',
      '最终的结果如何？客户满意吗？',
    ],
    tech: [
      '能展开说说这个技术方案的选型过程吗？',
      '为什么选择这个方案而不是其他方案？',
      '这个技术方案上线后的效果如何？有没有遇到什么坑？',
    ],
    leadership: [
      '你是怎么推动这件事落地的？遇到了什么阻力？',
      '团队成员的能力参差不齐，你是怎么处理的？',
      '你觉得好的管理者应该具备什么特质？',
    ],
  };

  // 通用追问（当没有识别到特定关键词时使用）
  const GENERIC_FOLLOWUPS = [
    '能再展开说说吗？具体的细节是什么？',
    '这件事最终的结果如何？有没有数据支撑？',
    '如果现在让你重新做一次，你会有什么不同的做法？',
    '你觉得这件事最能体现你的什么能力？',
  ];

  // 根据岗位类型生成行业问题
  const JOB_QUESTIONS = {
    culture_media: [
      '你平时关注哪些内容平台？最近有没有看到什么让你印象深刻的爆款内容？',
      '如果让你从0到1运营一个账号，你会怎么做？能说说你的思路吗？',
      '你怎么看待内容创作和数据分析之间的关系？',
      '能分享一个你参与过的内容项目吗？具体做了什么？效果如何？',
    ],
    operations: [
      '你认为运营的核心指标是什么？为什么？',
      '能说说你做过的最成功的一次活动策划吗？从策划到执行的完整过程？',
      '如果用户增长停滞了，你会从哪些方面去分析和突破？',
      '你怎么理解用户运营和内容运营的关系？',
    ],
    technical: [
      '能说说你做过的最有挑战性的技术项目吗？',
      '你在技术选型的时候，通常会考虑哪些因素？',
      '能描述一下你处理过的最复杂的bug或技术问题吗？',
      '你怎么看待代码质量和开发效率之间的平衡？',
    ],
    sales: [
      '能分享一个你拿下最难搞的客户的经历吗？',
      '你的销售方法论是什么？能拆解一下你的成交流程吗？',
      '面对客户说"太贵了"，你通常怎么应对？',
      '你怎么维护客户关系？有没有自己的CRM方法？',
    ],
    design: [
      '能说说你最满意的一个设计作品吗？设计思路是什么？',
      '你怎么平衡用户需求和业务目标之间的冲突？',
      '能描述一下你的设计流程吗？从接到需求到最终交付？',
      '你怎么看待设计系统化？有没有相关经验？',
    ],
    management: [
      '你是怎么制定团队目标的？能说说你的目标拆解方法吗？',
      '团队中有人能力很强但不好管理，你会怎么处理？',
      '你是怎么做绩效考核的？有什么心得？',
      '能分享一个你推动变革或改进的成功案例吗？',
    ],
    general: [
      '能说说你过去工作中最有成就感的一件事吗？',
      '你怎么看待加班和工作效率的关系？',
      '你未来3年的职业规划是什么？',
      '你觉得自己最大的优势和需要改进的地方分别是什么？',
    ],
  };

  // 根据岗位名称匹配行业分类
  const JOB_KEYWORDS = {
    culture_media: ['新媒体', '自媒体', '内容', '短视频', 'MCN', '文案', '编导', '主播', '网红', '博主', '运营'],
    operations: ['运营', '产品运营', '用户运营', '内容运营', '活动策划', '社群'],
    technical: ['开发', '工程师', '程序员', '架构', '后端', '前端', '测试', '运维', 'Java', 'Python', 'Go', 'React', 'Vue'],
    sales: ['销售', '客户经理', 'BD', '商务', '拓展', '经纪人'],
    design: ['设计', 'UI', 'UX', '视觉', '平面', '交互', '美工'],
    management: ['管理', '总监', '主管', '经理', 'leader', 'CEO', 'COO', 'VP'],
    finance: ['财务', '会计', '审计', '税务', '出纳', 'Finance'],
    hr_admin: ['人事', 'HR', '招聘', '行政', '人力资源', 'HRBP'],
    data_analytics: ['数据分析', 'BI', '数据', '数据挖掘', '算法'],
    ecommerce_retail: ['电商', '店铺', '直播', '带货', '选品', '淘宝', '京东', '抖音'],
    education: ['教育', '老师', '教师', '培训', '课程', '助教', '讲师'],
  };

  function detectJobTypes(jobName) {
    const types = [];
    const text = jobName.toLowerCase();
    for (const [type, keywords] of Object.entries(JOB_KEYWORDS)) {
      for (const kw of keywords) {
        if (text.includes(kw.toLowerCase())) {
          types.push(type);
          break;
        }
      }
    }
    if (types.length === 0) types.push('general');
    return types;
  }

  // 从回答中提取关键词
  function extractKeywords(answer) {
    const found = [];
    for (const [key, pattern] of Object.entries(KEYWORD_PATTERNS)) {
      if (pattern.test(answer)) found.push(key);
    }
    return found;
  }

  function initInterviewSession(jobName) {
    const jobTypes = detectJobTypes(jobName);

    // 构建分类到题目的索引
    const categoryIndex = {};
    for (const [catKey, catNames] of Object.entries(CATEGORY_MAP)) {
      if (INTERVIEW_DB[catKey]) {
        for (const q of INTERVIEW_DB[catKey]) {
          if (!categoryIndex[catKey]) categoryIndex[catKey] = [];
          categoryIndex[catKey].push(q);
        }
      }
    }

    return {
      jobName, jobTypes, categoryIndex,
      asked: [], answers: [], round: 0,
      phase: 'warmup',
      phaseRound: 0,
      followups: [],
      usedFollowups: [],
      competencyScores: {},
      startTime: Date.now(),
    };
  }

  // 获取下一个问题（核心逻辑）
  // 注意：round 由外部（startInterview / getInterviewFeedback）管理递增
  function getNextQuestion(session) {
    // 1. 优先返回追问
    if (session.followups.length > 0) return session.followups.shift();

    // 2. 第1轮：暖场随机自我介绍
    if (session.round === 1) {
      return pickFromCategory(session, ['self_intro'], 'basic');
    }

    // 3. 第2-3轮：背景探索（从上一轮回答中提取追问）
    if (session.round <= 3) {
      // 检查上一轮回答是否有可追问的关键词
      const lastAnswer = session.answers[session.answers.length - 1];
      if (lastAnswer) {
        const keywords = extractKeywords(lastAnswer);
        for (const kw of keywords) {
          const templates = FOLLOWUP_TEMPLATES[kw];
          if (templates) {
            const usedKey = kw + '_' + session.round;
            if (!session.usedFollowups.includes(usedKey)) {
              session.usedFollowups.push(usedKey);
              const fq = templates[Math.floor(Math.random() * templates.length)];
              return { id: 'fu_' + Date.now(), q: fq, cat: '追问', tips: '基于候选人回答的深度追问', w: 15 };
            }
          }
        }
      }
      // 没有可追问的，从背景分类中选题
      return pickFromCategory(session, ['self_intro', 'career_gap', 'career_change', 'general'], 'basic');
    }

    // 4. 第4-7轮：能力+行业问题
    if (session.round <= 7) {
      // 交替问行业问题和通用能力问题
      if (session.round % 2 === 0) {
        // 行业问题
        const jobQs = [];
        for (const t of session.jobTypes) {
          if (JOB_QUESTIONS[t]) jobQs.push(...JOB_QUESTIONS[t]);
        }
        if (jobQs.length > 0) {
          const unused = jobQs.filter((_, i) => !session.asked.includes('jq_' + i));
          if (unused.length > 0) {
            const idx = Math.floor(Math.random() * unused.length);
            const q = unused[idx];
            const qid = 'jq_' + session.round + '_' + idx;
            session.asked.push(qid);
            return { id: qid, q, cat: '行业问题', tips: '考察对岗位和行业的理解', w: 20 };
          }
        }
      }
      // 通用能力问题
      return pickFromCategory(session, ['general', 'teamwork', 'pressure', 'decision'], 'intermediate');
    }

    // 5. 第8-11轮：行为面试+深度追问
    if (session.round <= 11) {
      const lastAnswer = session.answers[session.answers.length - 1];
      if (lastAnswer) {
        const keywords = extractKeywords(lastAnswer);
        for (const kw of keywords) {
          const templates = FOLLOWUP_TEMPLATES[kw];
          if (templates) {
            const usedKey = kw + '_' + session.round;
            if (!session.usedFollowups.includes(usedKey)) {
              session.usedFollowups.push(usedKey);
              const fq = templates[Math.floor(Math.random() * templates.length)];
              return { id: 'fu_' + Date.now(), q: fq, cat: '深度追问', tips: '深入挖掘行为细节', w: 20 };
            }
          }
        }
      }
      // 行为面试题
      return pickFromCategory(session, ['teamwork', 'pressure', 'decision', 'customer_service'], 'advanced');
    }

    // 6. 第12-14轮：匹配+收尾
    if (session.round <= 14) {
      if (session.round === 12) {
        return pickFromCategory(session, ['general'], 'intermediate'); // 职业规划
      }
      if (session.round === 13) {
        return pickFromCategory(session, ['general'], 'intermediate'); // 求职动机
      }
      // 反问环节
      return { id: 'closing_1', q: '最后，你有什么想问我的吗？', cat: '反问环节', tips: '考察候选人的主动性和思考深度', w: 10 };
    }

    // 7. 第15轮：结束语
    return null;
  }

  // 按分类选题
  function pickFromCategory(session, catKeys, targetDifficulty) {
    let candidates = [];
    for (const catKey of catKeys) {
      if (session.categoryIndex[catKey]) {
        candidates.push(...session.categoryIndex[catKey]);
      }
    }
    candidates = candidates.filter(q => !session.asked.includes(q.id));
    if (candidates.length === 0) {
      // 从所有题目中补充
      const allQ = Object.values(INTERVIEW_DB).flat();
      candidates = allQ.filter(q => !session.asked.includes(q.id));
    }
    if (candidates.length === 0) return null;

    // 按难度排序
    const difficultyOrder = { basic: 0, intermediate: 1, advanced: 2 };
    candidates.sort((a, b) => {
      const da = difficultyOrder[classifyDifficulty(a)] || 0;
      const db = difficultyOrder[classifyDifficulty(b)] || 0;
      return Math.abs(da - difficultyOrder[targetDifficulty]) - Math.abs(db - difficultyOrder[targetDifficulty]);
    });

    const q = candidates[0];
    session.asked.push(q.id);
    return q;
  }

  // 按ID查找特定题目
  function findQuestion(session, ids) {
    for (const catKey of Object.keys(session.categoryIndex)) {
      for (const q of session.categoryIndex[catKey]) {
        if (ids.includes(q.id) && !session.asked.includes(q.id)) {
          session.asked.push(q.id);
          return q;
        }
      }
    }
    return null;
  }

  // 追问功能由第一个generateFollowups（第1978行）负责
  // 追问功能由第一个generateFollowups（第1978行）负责

  // ═══════════════════════════════════════════════════
  //  六维胜任力评估体系（Competency Framework）
  //  基于 Moka / 北森 / HireVue 等专业面试系统标准
  //  每个维度5级行为锚定（BARS），确保评分一致性
  // ═══════════════════════════════════════════════════

  const COMPETENCIES = {
    professional: { name: '专业能力', icon: 'ri-medal-line', weight: 0.25,
      anchors: {
        5: '系统掌握岗位核心知识，能独立解决复杂专业问题，有深度行业洞察',
        4: '专业基础扎实，能解决大部分岗位问题，有一定实战经验',
        3: '掌握基本专业技能，能完成常规工作任务',
        2: '专业知识不足，需要频繁求助',
        1: '缺乏岗位所需的基本专业知识'
      }},
    communication: { name: '沟通表达', icon: 'ri-chat-quote-line', weight: 0.20,
      anchors: {
        5: '逻辑清晰、结构化表达，善用案例和数据佐证，有说服力',
        4: '表达清晰有条理，能准确传达核心观点',
        3: '基本清楚但缺乏结构，偶尔表达不够精炼',
        2: '表达混乱逻辑跳跃，重点不突出',
        1: '语无伦次，无法清晰传达信息'
      }},
    problem_solving: { name: '问题解决', icon: 'ri-lightbulb-line', weight: 0.20,
      anchors: {
        5: '系统拆解问题，找到根因并提出创新方案，有数据验证',
        4: '有分析思路，能提出有效解决方案并执行',
        3: '能解决常规问题但缺乏系统方法',
        2: '缺乏分析思路，方案简单',
        1: '无法有效分析和解决问题'
      }},
    teamwork: { name: '团队协作', icon: 'ri-team-line', weight: 0.15,
      anchors: {
        5: '主动推动跨部门协作，化解冲突，激发团队潜能',
        4: '善于团队合作，能协调不同意见达成目标',
        3: '能配合团队完成工作，但缺乏主动协调',
        2: '更倾向于独立工作，协作意识较弱',
        1: '缺乏团队意识，难以融入集体'
      }},
    learning: { name: '学习成长', icon: 'ri-graduation-cap-line', weight: 0.10,
      anchors: {
        5: '主动学习新技能并快速应用到工作中，有明确成长路径',
        4: '有学习习惯，能跟上行业发展和岗位需求',
        3: '被动学习，缺乏主动性但能完成培训',
        2: '学习能力不足，难以适应变化',
        1: '拒绝学习，固守旧有方式'
      }},
    resilience: { name: '抗压韧性', icon: 'ri-shield-line', weight: 0.10,
      anchors: {
        5: '高压下保持冷静，从挫折中快速恢复并总结经验',
        4: '能承受工作压力，有应对逆境的实际经验',
        3: '能扛一般压力，面对极端不确定性时表现一般',
        2: '抗压能力较弱，容易受挫影响状态',
        1: '面对压力容易崩溃，缺乏应对机制'
      }},
  };

  function analyzeSTAR(text) {
    const t = (text || '').trim();
    const len = t.length;
    const hasSituation = /当时|在.*的时候|有一次|之前在|背景是|情况是|那时|那个时候/.test(t);
    const hasTask = /我的任务|负责|需要完成|目标是|被要求|被指派|我的职责|要做的/.test(t);
    const hasAction = /我做了|我采取|我通过|我决定|我主动|我的做法|具体来说|首先.*然后|第一步|我联系|我组织|我协调|我分析/.test(t);
    const hasResult = /\d+[%％万元人天次个月年]|提升了?\d+|增长了?\d+|节省了?\d+|降低|最终|结果|效果|达到|完成|实现了?|成功|赢得了?/.test(t);
    const elements = [hasSituation, hasTask, hasAction, hasResult];
    const completeness = Math.round((elements.filter(Boolean).length / 4) * 100);
    let specificity = 0;
    if (/公司|团队|项目|客户|产品|部门|季度|年度/.test(t)) specificity += 30;
    if (/\d+/.test(t)) specificity += 30;
    if (/当时|有一次|曾经|具体来说/.test(t)) specificity += 20;
    if (len > 100) specificity += 20;
    const quantified = (t.match(/\d+[%％万元人天次个月年]|增长|提升|节省|降低|优化|改善/g) || []).length;
    const quantScore = Math.min(quantified * 20, 100);
    const personalContrib = /我做了|我决定|我主动|我的方案|我提出|我负责/.test(t) ? 80 : /我们|团队/.test(t) ? 50 : 40;
    const starScore = Math.round(completeness * 0.3 + Math.min(specificity, 100) * 0.25 + quantScore * 0.25 + personalContrib * 0.2);
    return { hasSituation, hasTask, hasAction, hasResult, completeness, specificity: Math.min(specificity, 100), quantScore: Math.min(quantScore, 100), personalContrib, wordCount: len, starScore };
  }

  function scoreAnswer(text, question) {
    if (!text || text.trim().length < 5) {
      return { score: 10, level: '无效', color: '#dc2626', star: analyzeSTAR(''),
        components: { starComponent: 0, specificityComponent: 0, quantComponent: 0, personalComponent: 0, depthComponent: 0 },
        feedbackParts: ['回答内容较少，可以再展开说说'], suggestions: ['试着多说一些，比如举一个具体的工作案例'] };
    }
    const star = analyzeSTAR(text);
    const len = text.length;
    const starComponent = star.starScore;
    const specificityComponent = star.specificity;
    const quantComponent = star.quantScore;
    const personalComponent = star.personalContrib;
    const depthComponent = len >= 150 ? 90 : len >= 100 ? 75 : len >= 60 ? 60 : len >= 30 ? 40 : 20;
    const totalScore = Math.round(starComponent * 0.30 + specificityComponent * 0.25 + quantComponent * 0.20 + personalComponent * 0.10 + depthComponent * 0.15);
    let level, color;
    if (totalScore >= 85) { level = '优秀'; color = '#16a34a'; }
    else if (totalScore >= 70) { level = '良好'; color = '#2ea56a'; }
    else if (totalScore >= 55) { level = '一般'; color = '#d97706'; }
    else { level = '待提升'; color = '#dc2626'; }
    const feedbackParts = [];
    if (!star.hasSituation) feedbackParts.push('可以说说当时是什么情况、什么背景下做的这件事');
    if (!star.hasTask) feedbackParts.push('可以说说你在这个项目中具体负责哪一块');
    if (!star.hasAction) feedbackParts.push('可以说说你具体采取了哪些措施');
    if (!star.hasResult) feedbackParts.push('可以说说最后效果怎么样');
    if (len < 50) feedbackParts.push('回答比较简洁，可以再展开一些');
    if (!/\d+/.test(text)) feedbackParts.push('如果能加上一些数据会更有说服力');
    const suggestions = [];
    if (!star.hasSituation) suggestions.push('先简单交代一下当时的背景');
    if (!star.hasTask) suggestions.push('说清楚你个人负责的具体工作');
    if (!star.hasAction) suggestions.push('说说你具体做了什么，比如第一步做了什么、第二步做了什么');
    if (!star.hasResult) suggestions.push('最后结果怎么样？如果有数据可以提一下');
    if (star.specificity < 50) suggestions.push('可以加一些具体细节，比如项目名称、时间节点等');
    return { score: Math.min(totalScore, 100), level, color, star, components: { starComponent, specificityComponent, quantComponent, personalComponent, depthComponent }, feedbackParts, suggestions };
  }

  function detectCompetencies(text) {
    const t = (text || '').toLowerCase();
    const matched = [];
    // 专业能力：岗位知识、技能、行业经验
    if (/专业|技术|技能|知识|经验|行业|岗位|资质|证书|认证|掌握|熟悉|精通|熟练/.test(t)) matched.push('professional');
    // 沟通表达：汇报、协调、说服、表达
    if (/沟通|汇报|协调|说服|表达|谈判|反馈|演讲|讲述|介绍|说明/.test(t)) matched.push('communication');
    // 问题解决：分析、排查、方案、创新
    if (/问题|解决|分析|排查|诊断|根因|方案|创新|优化|改进|改善/.test(t)) matched.push('problem_solving');
    // 团队协作：团队合作、跨部门、冲突处理
    if (/团队|协作|合作|跨部门|配合|冲突|协调|一起|共同|互助/.test(t)) matched.push('teamwork');
    // 学习成长：学习、培训、提升
    if (/学习|培训|提升|进修|考证|新技能|掌握|了解|自学|研究/.test(t)) matched.push('learning');
    // 抗压韧性：压力、挑战、挫折
    if (/压力|挑战|挫折|困难|加班|高强度|紧急|危机|失败|逆境/.test(t)) matched.push('resilience');
    return matched.length > 0 ? matched : ['communication'];
  }

  function getInterviewFeedback(session, userAnswer) {
    const q = session.asked[session.asked.length - 1];
    const analysis = scoreAnswer(userAnswer, q);

    // 记录本次回答的胜任力
    const detectedComps = detectCompetencies(userAnswer);
    for (const c of detectedComps) {
      if (!session.competencyScores[c]) session.competencyScores[c] = [];
      session.competencyScores[c].push(analysis.score);
    }

    session.answers.push({ question: q, answer: userAnswer, analysis });
    session.round++;

    // 智能追问
    const followups = generateFollowups(userAnswer, q, session);
    if (followups.length > 0) {
      const fu = followups[0];
      updateFollowupProgress(session, fu);
      session.followups = [...(session.followups || []), fu];
    }

    const nextQ = getNextQuestion(session);
    session.currentQ++;

    // 生成专业AI回应（模拟真实面试官风格）
    let aiResponse = '';

    // STAR状态
    let starMsg = '【回答结构】';
    starMsg += analysis.star.hasSituation ? ' ✓情境' : ' ✗情境';
    starMsg += analysis.star.hasTask ? ' ✓任务' : ' ✗任务';
    starMsg += analysis.star.hasAction ? ' ✓行动' : ' ✗行动';
    starMsg += analysis.star.hasResult ? ' ✓结果' : ' ✗结果';

    // 评分反馈
    let scoreMsg = '';
    if (analysis.score >= 80) {
      scoreMsg = `评分 ${analysis.score}/100（${analysis.level}）`;
    } else if (analysis.score >= 60) {
      const missing = [];
      if (!analysis.star.hasSituation) missing.push('情境描述');
      if (!analysis.star.hasTask) missing.push('任务说明');
      if (!analysis.star.hasAction) missing.push('行动步骤');
      if (!analysis.star.hasResult) missing.push('结果量化');
      scoreMsg = `评分 ${analysis.score}/100（${analysis.level}）`;
      if (missing.length > 0) scoreMsg += `\n建议补充：${missing.join('、')}`;
    } else {
      scoreMsg = `评分 ${analysis.score}/100（${analysis.level}）`;
      if (analysis.suggestions[0]) scoreMsg += `\n${analysis.suggestions[0]}`;
    }

    // 组合反馈
    aiResponse = starMsg + '\n' + scoreMsg;

    // 追问或下一题
    if (session.followups && session.followups.length > 0) {
      aiResponse += '\n\n追问：' + session.followups[0].q;
    } else {
      aiResponse += '\n\n下一题：' + nextQ.q;
    }

    return {
      feedbackParts: analysis.feedbackParts, score: analysis.score,
      level: analysis.level, color: analysis.color,
      isLast: false, aiResponse, nextQuestion: nextQ,
      round: session.round, star: analysis.star,
      competencyFeedback: detectedComps.map(c => ({ key: c, name: COMPETENCIES[c]?.name, score: analysis.score })),
    };
  }

  function endInterview(session) {
    const round = session.round || 0;
    let closingMsg = '';
    if (round === 0) {
      closingMsg = '感谢您参加今天的面试。由于回答轮次较少，报告可能不够全面，建议您再次尝试以获得更准确的评估。正在生成评估报告...';
    } else if (round <= 3) {
      closingMsg = '感谢您今天的参与。由于面试轮次较少，部分评估维度可能不够充分。正在为您生成评估报告，建议您稍后再次练习以获得更完整的评估。';
    } else {
      closingMsg = '感谢您今天的参与和分享！您的面试表现已全面记录。正在为您生成专业评估报告，包含六维能力雷达图和针对性改进建议，请稍候...';
    }
    return {
      feedbackParts: [], score: 0, level: '', isLast: true,
      aiResponse: closingMsg,
      round: session.round,
    };
  }

  // ═══════════════════════════════════════════════════
  //  专业胜任力面试报告生成器
  // ═══════════════════════════════════════════════════

  function generateInterviewReport(session) {
    const totalScore = Math.round(session.answers.reduce((s, a) => s + a.analysis.score, 0) / session.answers.length);
    const duration = Math.round((Date.now() - session.startTime) / 1000);

    // 1. 按类别统计
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

    // 2. 胜任力综合评分
    const competencyResults = {};
    for (const [key, comp] of Object.entries(COMPETENCIES)) {
      const scores = session.competencyScores[key] || [];
      const avg = scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0;
      let level;
      if (avg >= 85) level = '优秀';
      else if (avg >= 70) level = '良好';
      else if (avg >= 55) level = '一般';
      else level = '待提升';
      competencyResults[key] = { name: comp.name, score: avg, level, anchor: comp.anchors[Math.min(5, Math.max(1, Math.round(avg / 20)))] || '' };
    }

    // 3. STAR完整性统计
    let starComplete = 0, starPartial = 0, starMissing = 0;
    for (const a of session.answers) {
      const s = a.analysis.star;
      const count = [s.hasSituation, s.hasTask, s.hasAction, s.hasResult].filter(Boolean).length;
      if (count === 4) starComplete++;
      else if (count >= 2) starPartial++;
      else starMissing++;
    }

    // 4. 各维度组件均分
    const compAvg = { star: 0, specificity: 0, quant: 0, personal: 0, depth: 0 };
    for (const a of session.answers) {
      const c = a.analysis.components || {};
      compAvg.star += (c.starComponent || 0);
      compAvg.specificity += (c.specificityComponent || 0);
      compAvg.quant += (c.quantComponent || 0);
      compAvg.personal += (c.personalComponent || 0);
      compAvg.depth += (c.depthComponent || 0);
    }
    const n = session.answers.length || 1;
    compAvg.star = Math.round(compAvg.star / n);
    compAvg.specificity = Math.round(compAvg.specificity / n);
    compAvg.quant = Math.round(compAvg.quant / n);
    compAvg.personal = Math.round(compAvg.personal / n);
    compAvg.depth = Math.round(compAvg.depth / n);

    // 5. 排序找出强项弱项
    const sorted = Object.entries(avgByCategory).sort((a, b) => b[1] - a[1]);
    const strengths = sorted.filter(([, s]) => s >= 70).map(([cat]) => cat);
    const weaknesses = sorted.filter(([, s]) => s < 60).map(([cat]) => cat);

    // 6. 总体评级
    let level, color, suggestion;
    if (totalScore >= 85) {
      level = '面试表现优秀';
      color = '#16a34a';
      suggestion = '你的面试表现整体出色，结构化表达和数据意识都很强。建议继续保持自信和条理，面试时注意语速控制和眼神交流。';
    } else if (totalScore >= 70) {
      level = '面试表现良好';
      color = '#2ea56a';
      suggestion = '基础扎实，回答结构比较完整。建议在薄弱环节重点准备，多举具体案例，有数据支撑会更有说服力。';
    } else if (totalScore >= 55) {
      level = '面试表现一般';
      color = '#d97706';
      suggestion = '有一定基础但缺乏亮点。建议准备3-5个成功案例，每个案例说清楚背景、你做了什么、最后结果怎么样。';
    } else {
      level = '需要加强准备';
      color = '#dc2626';
      suggestion = '建议系统准备：① 梳理3-5个核心案例 ② 每个案例准备量化数据 ③ 多做模拟练习，提升表达流利度。';
    }

    // 7. 关键词
    const allKeywords = [...new Set(session.answers.flatMap(a => a.analysis.keywords || []))];

    return {
      jobName: session.jobName,
      totalScore, level, color, suggestion,
      duration: `${Math.floor(duration / 60)}分${duration % 60}秒`,
      totalQuestions: session.answers.length,
      answeredQuestions: session.answers.length,
      // 胜任力雷达数据
      competencies: competencyResults,
      competencyRadar: Object.entries(competencyResults).map(([k, v]) => ({ key: k, name: v.name, score: v.score })),
      // STAR分析
      starAnalysis: { complete: starComplete, partial: starPartial, missing: starMissing },
      // 维度组件
      componentScores: compAvg,
      // 分类统计
      categoryScores: avgByCategory,
      strengths, weaknesses, keywords: allKeywords,
      // 详细回答分析
      details: session.answers.map(a => ({
        question: a.question.q,
        category: a.question.cat,
        answer: a.answer,
        score: a.analysis.score,
        level: a.analysis.level,
        color: a.analysis.color,
        feedback: (a.analysis.feedbackParts || []).join('；'),
        suggestion: a.analysis.suggestions.join('；'),
        star: a.analysis.star,
        components: a.analysis.components,
      }))
    };
  }

  return {
    scoreJob, buildReport, gapSkills, gapCoursePlan, reasonText, jobById, courseById, levelOf, detectAgeBias, diagnoseResume, generateAssessmentAnalysis, computeTraitScores,
    initInterviewSession, getNextQuestion, getInterviewFeedback, endInterview, generateInterviewReport, COMPETENCIES,
  };
}));
