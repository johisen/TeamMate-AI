from typing import Dict, List, Any, Optional, Tuple
from enum import Enum
import re

from app.core.config import settings


class TaskComplexity(Enum):
    SIMPLE = "simple"
    MEDIUM = "medium"
    COMPLEX = "complex"


class TaskRouter:
    """Routes tasks to appropriate models based on complexity analysis

    Strategy:
    - Simple tasks: Use cheap/fast models (GLM, MiniMax)
    - Medium tasks: Use balanced models
    - Complex tasks: Use high-end models (GPT-4, Claude, DeepSeek)
    """

    SIMPLE_TASK_PATTERNS = [
        r"^(hi|hello|hey|你好|您好|帮忙)",
        r"^(what is|who is|how to|什么是|如何|怎么)",
        r"^(tell me|show me|给我看|告诉我)",
        r"(trivia|fact|one thing|一件事|小知识)",
        r"(translate|翻译|convert|转换|计算|calculate)",
    ]

    COMPLEX_TASK_PATTERNS = [
        r"(analyze|analysis|分析|研究)",
        r"(compare|contrast|对比|比较)",
        r"(strategy|strategic|策略|战略)",
        r"(design|architecture|设计|架构)",
        r"(optimize|optimization|优化)",
        r"(debug|debugging|调试|排查)",
        r"(complex|complicated|复杂)",
        r"(multi.?step|多步|多个步骤)",
        r"(reasoning|逻辑|推理)",
        r"(creative|creative|创意)",
    ]

    SIMPLE_INDICATORS = [
        "greeting", "introduction", "simple question",
        "translation", "conversion", "calculation",
        "definition", "fact lookup", "time query",
    ]

    COMPLEX_INDICATORS = [
        "analysis", "research", "comparison",
        "strategy", "design", "architecture",
        "optimization", "debugging", "multi-step",
        "reasoning", "creative", "planning",
    ]

    def __init__(self):
        self.simple_model = getattr(settings, 'SIMPLE_MODEL', 'deepseek-chat')
        self.medium_model = getattr(settings, 'MEDIUM_MODEL', 'deepseek-chat')
        self.complex_model = getattr(settings, 'COMPLEX_MODEL', settings.DEFAULT_MODEL)

        self.simple_keywords = getattr(settings, 'SIMPLE_TASK_KEYWORDS', '').split(',') if hasattr(settings, 'SIMPLE_TASK_KEYWORDS') else []
        self.complex_keywords = getattr(settings, 'COMPLEX_TASK_KEYWORDS', '').split(',') if hasattr(settings, 'COMPLEX_TASK_KEYWORDS') else []

    def analyze_complexity(self, task_description: str) -> Tuple[TaskComplexity, str]:
        score = 0
        reasons = []

        task_lower = task_description.lower()

        for pattern in self.SIMPLE_TASK_PATTERNS:
            if re.search(pattern, task_lower, re.IGNORECASE):
                score -= 2
                reasons.append(f"匹配简单任务模式: {pattern}")

        for pattern in self.COMPLEX_TASK_PATTERNS:
            if re.search(pattern, task_lower, re.IGNORECASE):
                score += 2
                reasons.append(f"匹配复杂任务模式: {pattern}")

        for keyword in self.simple_keywords:
            if keyword.strip().lower() in task_lower:
                score -= 1
                reasons.append(f"简单关键词: {keyword}")

        for keyword in self.complex_keywords:
            if keyword.strip().lower() in task_lower:
                score += 1
                reasons.append(f"复杂关键词: {keyword}")

        task_length = len(task_description)
        if task_length < 50:
            score -= 1
            reasons.append("任务描述较短")
        elif task_length > 500:
            score += 1
            reasons.append("任务描述较长")

        if any(word in task_lower for word in self.SIMPLE_INDICATORS):
            score -= 1
            reasons.append("包含简单任务指示词")

        if any(word in task_lower for word in self.COMPLEX_INDICATORS):
            score += 1
            reasons.append("包含复杂任务指示词")

        if score <= -2:
            return TaskComplexity.SIMPLE, "; ".join(reasons) if reasons else "简单任务"
        elif score >= 2:
            return TaskComplexity.COMPLEX, "; ".join(reasons) if reasons else "复杂任务"
        else:
            return TaskComplexity.MEDIUM, "; ".join(reasons) if reasons else "中等复杂度"

    def route(self, task_description: str, forced_model: Optional[str] = None) -> str:
        if forced_model:
            return forced_model

        complexity, reason = self.analyze_complexity(task_description)

        if complexity == TaskComplexity.SIMPLE:
            return self.simple_model
        elif complexity == TaskComplexity.COMPLEX:
            return self.complex_model
        else:
            return self.medium_model

    def get_routing_info(self, task_description: str) -> Dict[str, Any]:
        complexity, reason = self.analyze_complexity(task_description)
        model = self.route(task_description)

        return {
            "complexity": complexity.value,
            "reason": reason,
            "recommended_model": model,
            "simple_model": self.simple_model,
            "medium_model": self.medium_model,
            "complex_model": self.complex_model,
        }

    def batch_route(self, task_descriptions: List[str]) -> List[Dict[str, Any]]:
        return [self.get_routing_info(td) for td in task_descriptions]


task_router = TaskRouter()
