/**
 * 面试回答分析引擎 v1.0
 * 
 * 基于中英文面试研究的12类常见错误模式检测
 * 数据来源：HBS、LinkedIn调研、HR专家总结、NLP面试研究论文
 * 
 * 12类错误模式：
 * 1.  too_short       — 回答过短，缺乏实质内容
 * 2.  no_example      — 慷慨陈词但举不出具体例子
 * 3.  no_star         — 缺乏STAR结构（情境-任务-行动-结果）
 * 4.  no_quantify     — 没有数据支撑，缺乏量化成果
 * 5.  off_topic       — 偏题，没有直接回答问题
 * 6.  negative_tone   — 负面情绪（抱怨前公司/领导）
 * 7.  too_vague       — 过于笼统泛化，像万金油模板
 * 8.  no_self_aware   — 假扮完美，不承认弱点或挫折
 * 9.  no_result       — 有行动但没有结果/成效
 * 10. too_much_filler — 废话太多，核心信息密度低
 * 11. repetitive      — 重复表达相同观点
 * 12. over_hedge      — 过度谦虚/不确定，缺乏自信
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AnswerAnalyzer = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  // ═══════════════════════════════════════════════════
  //  错误模式定义
  // ═══════════════════════════════════════════════════

  const MISTAKE_PATTERNS = {
    too_short: {
      id: 'too_short',
      name: '回答过短',
      severity: 'high',
      icon: '📝',
      description: '回答内容太少，没有展示足够的思考深度',
      suggestion: '面试中每个回答建议至少100字（3-5句话），展示你的思考过程和具体经验。',
      detect: function(text, question) {
        var len = text.replace(/\s/g, '').length;
        if (len < 15) return { matched: true, detail: '仅' + len + '个字，几乎没有实质内容' };
        if (len < 40) return { matched: true, detail: '仅' + len + '个字，内容过于简短' };
        return { matched: false };
      }
    },

    no_example: {
      id: 'no_example',
      name: '缺乏实例',
      severity: 'high',
      icon: '💡',
      description: '只有观点没有例子，无法让面试官信服',
      suggestion: '用"比如"、"有一次"、"举个例子"引出真实案例，事实胜于雄辩。',
      detect: function(text) {
        var hasExample = /比如|例如|举个例子|有一次|举一个|举例|案例|当时在|记得有/.test(text);
        var hasStory = /我曾经|我之前|我做过|我参与|我负责|我主导|我带领/.test(text);
        if (!hasExample && !hasStory && text.length > 50) {
          return { matched: true, detail: '有观点但没有具体事例支撑' };
        }
        return { matched: false };
      }
    },

    no_star: {
      id: 'no_star',
      name: '缺乏STAR结构',
      severity: 'medium',
      icon: '⭐',
      description: '没有按照情境→任务→行动→结果的结构组织回答',
      suggestion: '用STAR法则组织：当时什么情况(S)→你的任务是什么(T)→你做了什么(A)→结果如何(R)。',
      detect: function(text) {
        var hasS = /当时|那时候|之前|有一次|在[^\s]{2,6}(?:的时候|期间|项目中)/.test(text);
        var hasT = /需要|要求|目标|任务|负责|要做|面临/.test(text);
        var hasA = /我做了|我通过|我采取|我决定|我负责|我主导|我协调|我优化|我搭建/.test(text);
        var hasR = /结果|最终|完成后|上线后|优化后|提升了?|增长了?|节省了?|达到了?/.test(text);

        var score = (hasS ? 1 : 0) + (hasT ? 1 : 0) + (hasA ? 1 : 0) + (hasR ? 1 : 0);
        if (text.length > 60 && score <= 1) {
          return { matched: true, detail: '缺乏结构化表达（仅覆盖STAR中的' + score + '个要素）' };
        }
        return { matched: false };
      }
    },

    no_quantify: {
      id: 'no_quantify',
      name: '缺少数据',
      severity: 'medium',
      icon: '📊',
      description: '没有用数字说话，缺乏量化成果',
      suggestion: '加入具体数据：提升了X%、管理X人团队、节省X万元、X天完成等。',
      detect: function(text) {
        var hasNumber = /\d+[%％万元人天次个月年周名]|\d+人|\d+万|\d+%/.test(text);
        var hasChange = /提升了?|增长了?|节省了?|翻了|从\d+到\d+|增加|减少|降低/.test(text);
        if (!hasNumber && !hasChange && text.length > 80) {
          return { matched: true, detail: '超过80字的回答中没有任何数据或量化描述' };
        }
        return { matched: false };
      }
    },

    negative_tone: {
      id: 'negative_tone',
      name: '负面情绪',
      severity: 'high',
      icon: '⚠️',
      description: '抱怨前公司、领导或同事，展示负面态度',
      suggestion: '即使有不好的经历，也要用积极的角度表述。重点说你从中学到了什么。',
      detect: function(text) {
        var negatives = /烂|差|垃圾|坑|受不了|忍无可忍|白痴|傻|蠢|变态|剥削|压榨|不公平|委屈|憋屈|恶心|讨厌|恨/.test(text);
        var blame = /都怪|都怨|还不是因为|完全是因为|全是.*的错|领导.*不行|公司.*垃圾|同事.*奇葩/.test(text);
        if (negatives || blame) {
          return { matched: true, detail: '检测到负面情绪表达' };
        }
        return { matched: false };
      }
    },

    too_vague: {
      id: 'too_vague',
      name: '过于笼统',
      severity: 'medium',
      icon: '🌫️',
      description: '回答像万金油模板，放到谁身上都适用',
      suggestion: '加入你独有的细节：具体公司名、项目名、工具名、你个人的角色和贡献。',
      detect: function(text) {
        var genericPhrases = /我是一个.*的人|我比较.*|我觉得.*还行|还可以|还好|差不多|一般般|都行|随便/.test(text);
        var noSpecifics = !/公司|团队|项目|客户|产品|部门|系统|平台|工具/.test(text);
        if (genericPhrases && noSpecifics && text.length > 30) {
          return { matched: true, detail: '回答过于泛化，缺乏具体场景和细节' };
        }
        return { matched: false };
      }
    },

    no_result: {
      id: 'no_result',
      name: '没有结果',
      severity: 'medium',
      icon: '🎯',
      description: '说了做了什么，但没说结果/成效/收获',
      suggestion: '行动之后一定要说结果：带来了什么改变、取得了什么成效、你学到了什么。',
      detect: function(text) {
        var hasAction = /我做了|我通过|我采取|我负责|我主导|我搭建|我优化|我协调|我负责/.test(text);
        var hasResult = /结果|最终|完成后|上线后|优化后|提升了?|增长了?|节省了?|达到了?|成效|收获|学到了?|效果/.test(text);
        if (hasAction && !hasResult && text.length > 50) {
          return { matched: true, detail: '描述了行动但没有提到结果或成效' };
        }
        return { matched: false };
      }
    },

    too_much_filler: {
      id: 'too_much_filler',
      name: '废话太多',
      severity: 'low',
      icon: '💬',
      description: '有效信息密度低，充斥大量填充词',
      suggestion: '精简表达，每句话都要传递有效信息。减少"然后"、"就是说"、"怎么说呢"等口头禅。',
      detect: function(text) {
        var fillers = (text.match(/然后|就是说|怎么说呢|就是|反正|那个|这个|嗯|额|啊|哦|啦|嘛|吧/g) || []).length;
        var words = text.replace(/\s/g, '').length;
        if (words > 50 && fillers / words > 0.08) {
          return { matched: true, detail: '填充词占比过高（' + Math.round(fillers / words * 100) + '%），有效信息密度低' };
        }
        return { matched: false };
      }
    },

    repetitive: {
      id: 'repetitive',
      name: '重复表达',
      severity: 'low',
      icon: '🔄',
      description: '同一个观点用不同的话反复说',
      suggestion: '一个观点说清楚即可，然后用新例子或新角度扩展。',
      detect: function(text) {
        // 按句拆分，检查是否有高度相似的句子
        var sentences = text.split(/[。，！？；\n]/).filter(function(s) { return s.trim().length > 10; });
        if (sentences.length < 3) return { matched: false };

        var duplicateCount = 0;
        for (var i = 0; i < sentences.length; i++) {
          for (var j = i + 1; j < sentences.length; j++) {
            // 计算两个句子的共同字符比例
            var s1 = sentences[i].replace(/\s/g, '');
            var s2 = sentences[j].replace(/\s/g, '');
            var common = 0;
            for (var k = 0; k < s1.length; k++) {
              if (s2.indexOf(s1[k]) >= 0) common++;
            }
            var similarity = common / Math.max(s1.length, s2.length);
            if (similarity > 0.6) duplicateCount++;
          }
        }
        if (duplicateCount > 0) {
          return { matched: true, detail: '检测到' + duplicateCount + '组重复表达' };
        }
        return { matched: false };
      }
    },

    over_hedge: {
      id: 'over_hedge',
      name: '过度谦虚',
      severity: 'low',
      icon: '🤝',
      description: '过多不确定表达，缺乏自信',
      suggestion: '适当自信地表达。把"可能大概也许"换成"我认为"、"我的经验是"。',
      detect: function(text) {
        var hedges = (text.match(/可能|大概|也许|也许吧|应该吧|不太确定|不太好说|我也不太懂|不太清楚|或许|算是吧|勉强|一般般/g) || []).length;
        if (hedges >= 3 && text.length > 30) {
          return { matched: true, detail: '检测到' + hedges + '处不确定表达，显得缺乏自信' };
        }
        return { matched: false };
      }
    },

    off_topic: {
      id: 'off_topic',
      name: '偏题',
      severity: 'high',
      icon: '🎯',
      description: '回答没有直接回应问题的核心',
      suggestion: '先直接回答问题，再展开。确保每段回答都能回扣到问题本身。',
      detect: function(text, question) {
        if (!question || !question.q) return { matched: false };
        // 提取问题中的关键词
        var qKeywords = question.q.replace(/[？?！!。，、]/g, ' ').split(/\s+/).filter(function(w) { return w.length >= 2; });
        if (qKeywords.length < 2) return { matched: false };

        // 检查回答是否覆盖问题关键词
        var matched = qKeywords.filter(function(kw) { return text.includes(kw); });
        var coverage = matched.length / qKeywords.length;

        if (text.length > 50 && coverage < 0.2) {
          return { matched: true, detail: '回答与问题关键词关联度低（仅覆盖' + Math.round(coverage * 100) + '%）' };
        }
        return { matched: false };
      }
    },

    no_self_aware: {
      id: 'no_self_aware',
      name: '缺乏自我认知',
      severity: 'medium',
      icon: '🪞',
      description: '假扮完美或对弱点/挫折避而不谈',
      suggestion: '诚实面对不足，展示自我认知和成长。说弱点时同时说你在如何改进。',
      detect: function(text, question) {
        // 只在特定类型的问题上检测
        var isWeakQ = /弱点|缺点|不足|挫折|失败|犯过错/.test((question && question.q) || '');
        if (!isWeakQ) return { matched: false };

        var perfectionist = /没有|从来没|一直都很好|不存在|不可能|完全没有/.test(text);
        var shortDenial = perfectionist && text.length < 30;
        if (shortDenial) {
          return { matched: true, detail: '对弱点/挫折类问题简单否认，缺乏自我反思' };
        }
        return { matched: false };
      }
    },
  };

  // ═══════════════════════════════════════════════════
  //  核心分析函数
  // ═══════════════════════════════════════════════════

  /**
   * 分析面试回答，检测常见错误模式
   * @param {string} answer - 用户回答文本
   * @param {object} question - 问题对象 { q, dimension, ... }
   * @returns {object} 分析结果
   */
  function analyze(answer, question) {
    var text = (answer || '').trim();
    var detected = [];
    var totalSeverity = 0;
    var severityWeight = { high: 3, medium: 2, low: 1 };

    // 逐个检测每种错误模式
    Object.keys(MISTAKE_PATTERNS).forEach(function(key) {
      var pattern = MISTAKE_PATTERNS[key];
      var result = pattern.detect(text, question);
      if (result.matched) {
        detected.push({
          id: pattern.id,
          name: pattern.name,
          severity: pattern.severity,
          icon: pattern.icon,
          description: pattern.description,
          suggestion: pattern.suggestion,
          detail: result.detail,
        });
        totalSeverity += severityWeight[pattern.severity] || 1;
      }
    });

    // 计算质量分数（0-100，100为完美）
    var maxSeverity = Object.keys(MISTAKE_PATTERNS).length * 3;
    var qualityScore = Math.max(0, Math.round(100 - (totalSeverity / maxSeverity * 100)));

    // 按严重度排序
    detected.sort(function(a, b) {
      return (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0);
    });

    // 生成综合评语
    var summary = generateSummary(detected, text.length, qualityScore);

    return {
      qualityScore: qualityScore,
      detected: detected,
      summary: summary,
      stats: {
        totalIssues: detected.length,
        highSeverity: detected.filter(function(d) { return d.severity === 'high'; }).length,
        mediumSeverity: detected.filter(function(d) { return d.severity === 'medium'; }).length,
        lowSeverity: detected.filter(function(d) { return d.severity === 'low'; }).length,
        answerLength: text.length,
      }
    };
  }

  function generateSummary(detected, length, score) {
    if (detected.length === 0) {
      return '回答质量很好，结构清晰、内容充实。继续保持！';
    }

    var parts = [];
    var highIssues = detected.filter(function(d) { return d.severity === 'high'; });
    var mediumIssues = detected.filter(function(d) { return d.severity === 'medium'; });

    if (score >= 80) {
      parts.push('整体不错，但有小问题可以优化：');
    } else if (score >= 60) {
      parts.push('回答有一定基础，但需要改进以下方面：');
    } else if (score >= 40) {
      parts.push('回答存在明显不足，建议重点改进：');
    } else {
      parts.push('回答质量较低，需要认真准备后再回答：');
    }

    // 列出最关键的问题（最多3个）
    var topIssues = detected.slice(0, 3);
    topIssues.forEach(function(issue) {
      parts.push(issue.icon + ' ' + issue.name + '：' + issue.detail);
    });

    // 给出第一步建议
    if (highIssues.length > 0) {
      parts.push('\n🎯 最重要的一步：' + highIssues[0].suggestion);
    }

    return parts.join('\n');
  }

  // ═══════════════════════════════════════════════════
  //  导出
  // ═══════════════════════════════════════════════════

  return {
    analyze: analyze,
    MISTAKE_PATTERNS: MISTAKE_PATTERNS,
  };

}));
