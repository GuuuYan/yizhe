"""Build the browser-ready character archive without rewriting source text."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "tests" / "fixtures" / "character-source.json"
OUTPUT = ROOT / "js" / "characters-data.js"

CATEGORIES = [
    {"id": "protagonists", "name": "主角团", "code": "CAST-01", "sourceIndexes": [4]},
    {"id": "fallen", "name": "陨落者", "code": "CAST-02", "sourceIndexes": [150]},
    {"id": "church", "name": "教会", "code": "CAST-03", "sourceIndexes": [232]},
    {"id": "chaotic-neutral", "name": "混乱中立", "code": "CAST-04", "sourceIndexes": [287]},
    {"id": "soul-guides", "name": "渡魂客", "code": "CAST-05", "sourceIndexes": [297]},
    {"id": "supporting", "name": "其他配角", "code": "CAST-06", "sourceIndexes": [345]},
    {"id": "pulaier", "name": "普莱尔的前辈们", "code": "CAST-07", "sourceIndexes": [443]},
    {"id": "god-era", "name": "神领时代／神领", "code": "CAST-08", "sourceIndexes": [473, 474]},
    {"id": "ancestors", "name": "前人与先祖", "code": "CAST-09", "sourceIndexes": [502]},
]

CHARACTERS = [
    ("huanyi", "幻易", "protagonists", 5, 33),
    ("tianguang", "天光", "protagonists", 35, 43),
    ("lingzhi", "凌至", "protagonists", 45, 54),
    ("kongshi", "空视", "protagonists", 56, 67),
    ("fen", "焚", "protagonists", 69, 74),
    ("ming", "冥", "protagonists", 75, 128),
    ("qiyue", "柒月", "protagonists", 130, 138),
    ("chuyu", "初雨", "protagonists", 140, 147),
    ("leader", "领袖", "fallen", 151, 157),
    ("peep", "窥视（莫韦斯-华）", "fallen", 159, 170),
    ("blast", "爆破（亓花燃）", "fallen", 172, 185),
    ("scholar", "博学/Era", "fallen", 187, 199),
    ("trample", "践踏（克罗律）", "fallen", 201, 212),
    ("summoner", "唤物", "fallen", 214, 229),
    ("truth-revived", "“真理”", "church", 233, 238),
    ("archbishop", "大主教", "church", 240, 247),
    ("envoys", "“使者”", "church", 249, 252),
    ("miluan", "迷乱", "church", 254, 268),
    ("dead-candle", "死烛", "church", 270, 284),
    ("zhengxian", "正闲", "chaotic-neutral", 288, 294),
    ("niying", "匿影", "soul-guides", 298, 316),
    ("waerxia", "瓦尔夏（渡魂客建立人之一）", "soul-guides", 318, 326),
    ("even", "Even", "soul-guides", 328, 336),
    ("aierna", "艾尔娜", "soul-guides", 338, 339),
    ("qinan", "栖南", "soul-guides", 341, 342),
    ("elementalist", "元素使", "supporting", 346, 355),
    ("blade-spirit", "刀灵", "supporting", 357, 386),
    ("wudeng", "梧灯", "supporting", 388, 396),
    ("alex", "艾里克斯", "supporting", 398, 402),
    ("kongqingming", "孔青冥（天光师傅）", "supporting", 404, 413),
    ("jiangxi", "姜曦（天光师母）", "supporting", 415, 419),
    ("linxing", "林杏（校医）", "supporting", 421, 433),
    ("pharmacist", "药剂师", "supporting", 435, 436),
    ("third-principal", "第三代克里乌斯(蒂莫)", "supporting", 438, 440),
    ("lingqingshi", "凌青石", "pulaier", 444, 446),
    ("kuilasier", "奎拉斯尔", "pulaier", 449, 455),
    ("guining", "瑰宁", "pulaier", 457, 464),
    ("haizikui", "海兹魁", "pulaier", 466, 470),
    ("truth-god", "真理-真理神领", "god-era", 475, 477),
    ("eternal-god", "永生-永生神领", "god-era", 479, 480),
    ("zhuhan", "诛寒-逆蔑神领", "god-era", 482, 483),
    ("yugehaina", "尤格海纳-海妖神领", "god-era", 485, 486),
    ("huideerge", "慧德尔格-天空神领", "god-era", 488, 489),
    ("atena", "阿忒娜-黄沙神领", "god-era", 491, 492),
    ("huoladekesi", "霍拉德克斯-草原神领领", "god-era", 494, 495),
    ("setisi", "瑟提斯-哲思神领", "god-era", 497, 499),
    ("playwright", "剧作家", "ancestors", 503, 506),
    ("keliwusi", "克里乌斯", "ancestors", 508, 510),
    ("huancheng", "幻诚", "ancestors", 512, 523),
    ("kongshi-ancient", "空时", "ancestors", 525, 536),
    ("lingling", "凌聆", "ancestors", 538, 550),
    ("yanluohe", "言洛和（改过名，非直系）", "ancestors", 552, 563),
    ("ailinuo", "艾莉诺", "ancestors", 565, 576),
    ("qiyin", "柒尹", "ancestors", 578, 589),
]

RELATION_PAIRS = [
    ("huanyi", "tianguang", "朋友／搭档", "朋友／搭档"),
    ("huanyi", "lingzhi", "朋友", "朋友"),
    ("huanyi", "zhengxian", "室友", "室友"),
    ("huanyi", "qiyue", "朋友", "朋友"),
    ("huanyi", "chuyu", "朋友", "朋友"),
    ("huanyi", "wudeng", "短暂的师傅", "短暂的学生"),
    ("huanyi", "elementalist", "附身／体外晶核", "宿主"),
    ("huanyi", "blade-spirit", "短暂的师傅", "短暂的学生"),
    ("tianguang", "kongqingming", "师傅", "徒弟"),
    ("tianguang", "jiangxi", "师母", "晚辈"),
    ("lingzhi", "lingqingshi", "父亲", "女儿"),
    ("lingzhi", "kuilasier", "护卫", "被护卫者"),
    ("lingzhi", "guining", "护卫", "被护卫者"),
    ("qiyue", "chuyu", "朋友", "朋友"),
    ("fen", "ming", "妹妹", "哥哥"),
    ("fen", "niying", "共同生活十年", "共同生活十年"),
    ("ming", "niying", "共同生活十年", "共同生活十年"),
    ("fen", "zhengxian", "朋友／各取所需", "朋友／各取所需"),
    ("ming", "zhengxian", "朋友／各取所需", "朋友／各取所需"),
    ("leader", "peep", "手下", "领袖"),
    ("leader", "blast", "手下", "领袖"),
    ("leader", "scholar", "手下", "领袖"),
    ("leader", "trample", "手下", "领袖"),
    ("leader", "summoner", "手下", "领袖"),
    ("archbishop", "envoys", "神职人员", "效忠"),
    ("archbishop", "miluan", "教会成员", "敬仰"),
    ("archbishop", "dead-candle", "死仆", "伺机反抗"),
    ("archbishop", "kongshi", "教会之子／容器", "教会培养者"),
    ("eternal-god", "truth-god", "身躯被剥夺者", "剥夺身躯者"),
    ("truth-revived", "kongshi", "借用身躯复活", "灵魂留存于内"),
    ("niying", "even", "师父", "徒弟"),
    ("niying", "aierna", "共同流浪", "好友／共同流浪"),
    ("waerxia", "alex", "好友", "好友"),
    ("even", "third-principal", "多次交流合作", "前辈／合作"),
    ("kuilasier", "guining", "共同护卫凌至", "共同护卫凌至"),
    ("guining", "haizikui", "曾在其手下工作", "下属／学者同僚"),
    ("miluan", "kongshi", "从小带大的孩子", "抚养者"),
    ("dead-candle", "kongshi", "友善对象／逃生机会", "友善但可能利用自己"),
    ("zhengxian", "miluan", "杀害父母的仇人", "受害者家属／追查者"),
    ("even", "blade-spirit", "青刀／刀灵", "曾经的持有者"),
    ("niying", "blade-spirit", "继承的刀灵／引导者", "继承者"),
    ("blade-spirit", "elementalist", "被压制者", "压制者"),
    ("elementalist", "niying", "被杀者", "杀害者"),
    ("alex", "keliwusi", "相识／理念来源", "相识／理念传播者"),
    ("lingqingshi", "kuilasier", "学生", "老师"),
    ("lingqingshi", "haizikui", "挚友", "挚友"),
    ("lingqingshi", "guining", "相识／同僚", "相识／同僚"),
    ("eternal-god", "zhuhan", "受其介入影响", "介入并加剧疯狂"),
    ("eternal-god", "huoladekesi", "反抗者／被斩杀", "统治者／杀害者"),
    ("eternal-god", "playwright", "手下／棋子", "上级／命令者"),
    ("eternal-god", "kongshi-ancient", "反抗者／施咒者", "敌人／被诅咒者"),
]

DIAGRAM_EVIDENCE = {
    "type": "embedded-relation-diagram",
    "asset": "word/media/image1.png",
}

SECOND_DIAGRAM_EVIDENCE = {
    "type": "embedded-relation-diagram",
    "asset": "word/media/image2.png",
}

RELATION_DISPLAY = {
    ("huanyi", "tianguang"): ("幻易 — 天光｜朋友／搭档", "friendship"),
    ("huanyi", "lingzhi"): ("幻易 — 凌至｜好友／借用相机", "friendship"),
    ("huanyi", "zhengxian"): ("幻易 — 正闲｜室友／情报往来", "friendship"),
    ("fen", "niying"): ("匿影 → 焚｜救助、共同生活十年、托付刀灵", "rescue"),
    ("ming", "niying"): ("匿影 → 冥｜救助、共同生活十年、托付刀灵", "rescue"),
    ("eternal-god", "truth-god"): ("永生 → 真理神领｜剥夺身躯", "body"),
    ("truth-revived", "kongshi"): ("“真理” → 空视｜借用身躯复活，空视灵魂留存", "body"),
    ("niying", "even"): ("Even → 匿影｜收为徒弟、交付指路石", "mentorship"),
    ("miluan", "kongshi"): ("迷乱 → 空视｜从小带大并影响战斗习惯", "care"),
    ("dead-candle", "kongshi"): ("死烛 → 空视｜友善，并视为逃生机会", "interest"),
    ("zhengxian", "miluan"): ("迷乱 → 正闲｜杀害其父母", "hostility"),
    ("even", "blade-spirit"): ("Even → 刀灵｜机缘巧合获得青刀", "inheritance"),
    ("niying", "blade-spirit"): ("刀灵 → 匿影｜被继承并引导匿影", "inheritance"),
    ("blade-spirit", "elementalist"): ("刀灵 → 元素使｜压制疯狂、维持理智", "control"),
    ("elementalist", "niying"): ("元素使 → 匿影｜杀害匿影", "hostility"),
    ("alex", "keliwusi"): ("艾里克斯 → 克里乌斯｜相识并传播其理念", "ideology"),
    ("lingqingshi", "kuilasier"): ("凌青石 → 奎拉斯尔｜老师／学生", "mentorship"),
    ("lingqingshi", "haizikui"): ("凌青石 — 海兹魁｜从小的挚友", "friendship"),
    ("lingqingshi", "guining"): ("凌青石 — 瑰宁｜工作期间相识", "colleague"),
    ("eternal-god", "zhuhan"): ("永生 → 诛寒｜介入并加剧其疯狂", "influence"),
    ("eternal-god", "huoladekesi"): ("永生 → 霍拉德克斯｜因反抗而将其斩杀", "hostility"),
    ("eternal-god", "playwright"): ("永生 → 剧作家｜命令其屠城或刺杀", "command"),
    ("eternal-god", "kongshi-ancient"): ("空时 → 永生｜对峙并留下诅咒", "hostility"),
}

RELATIONSHIP_NODES = [
    {
        "id": "era",
        "name": "Era",
        "category": "fallen",
        "profileId": "scholar",
    },
]

RELATIONSHIP_EDGES = [
    {
        "source": "scholar",
        "target": "era",
        "displayLabel": "同一身体｜主人格／副人格",
        "relationType": "identity",
        "evidence": {"type": "paragraphs", "indexes": [190, 195, 196, 197, 198]},
    },
    {
        "source": "leader",
        "target": "era",
        "displayLabel": "领袖 — Era｜陨落者成员",
        "relationType": "affiliation",
        "evidence": SECOND_DIAGRAM_EVIDENCE,
    },
]

RELATION_EVIDENCE = {
    ("qiyue", "chuyu"): {"type": "paragraphs", "indexes": [146]},
    ("fen", "ming"): {"type": "paragraphs", "indexes": [82]},
    ("fen", "niying"): {"type": "paragraphs", "indexes": [315]},
    ("ming", "niying"): {"type": "paragraphs", "indexes": [315]},
    ("fen", "zhengxian"): {"type": "paragraphs", "indexes": [294]},
    ("ming", "zhengxian"): {"type": "paragraphs", "indexes": [294]},
    ("eternal-god", "truth-god"): {"type": "paragraphs", "indexes": [235]},
    ("truth-revived", "kongshi"): {"type": "paragraphs", "indexes": [236]},
    ("niying", "even"): {"type": "paragraphs", "indexes": [335]},
    ("niying", "aierna"): {"type": "paragraphs", "indexes": [313]},
    ("waerxia", "alex"): {"type": "paragraphs", "indexes": [323, 324]},
    ("even", "third-principal"): {"type": "paragraphs", "indexes": [335]},
    ("kuilasier", "guining"): {"type": "paragraphs", "indexes": [453, 459]},
    ("guining", "haizikui"): {"type": "paragraphs", "indexes": [460]},
    ("miluan", "kongshi"): {"type": "paragraphs", "indexes": [64, 260]},
    ("dead-candle", "kongshi"): {"type": "paragraphs", "indexes": [276]},
    ("zhengxian", "miluan"): {"type": "paragraphs", "indexes": [294]},
    ("even", "blade-spirit"): {"type": "paragraphs", "indexes": [336]},
    ("niying", "blade-spirit"): {"type": "paragraphs", "indexes": [315, 381, 383, 384]},
    ("blade-spirit", "elementalist"): {"type": "paragraphs", "indexes": [349, 354]},
    ("elementalist", "niying"): {"type": "paragraphs", "indexes": [355]},
    ("alex", "keliwusi"): {"type": "paragraphs", "indexes": [401]},
    ("lingqingshi", "kuilasier"): {"type": "paragraphs", "indexes": [452]},
    ("lingqingshi", "haizikui"): {"type": "paragraphs", "indexes": [469]},
    ("lingqingshi", "guining"): {"type": "paragraphs", "indexes": [460]},
    ("eternal-god", "zhuhan"): {"type": "paragraphs", "indexes": [483]},
    ("eternal-god", "huoladekesi"): {"type": "paragraphs", "indexes": [495]},
    ("eternal-god", "playwright"): {"type": "paragraphs", "indexes": [504]},
    ("eternal-god", "kongshi-ancient"): {"type": "paragraphs", "indexes": [536]},
}


def main() -> None:
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    by_index = {item["index"]: item for item in source["paragraphs"]}
    records = []
    relation_map = {item[0]: [] for item in CHARACTERS}

    for left, right, left_label, right_label in RELATION_PAIRS:
        evidence = RELATION_EVIDENCE.get((left, right), DIAGRAM_EVIDENCE)
        display_label, relation_type = RELATION_DISPLAY.get((left, right), (None, None))
        left_relation = {"targetId": right, "label": left_label, "evidence": evidence}
        right_relation = {"targetId": left, "label": right_label, "evidence": evidence}
        if display_label:
            left_relation["displayLabel"] = display_label
            right_relation["displayLabel"] = display_label
        if relation_type:
            left_relation["relationType"] = relation_type
            right_relation["relationType"] = relation_type
        relation_map[left].append(left_relation)
        relation_map[right].append(right_relation)

    for character_id, name, category, start, end in CHARACTERS:
        paragraphs = [by_index[index] for index in range(start, end + 1) if index in by_index]
        records.append(
            {
                "id": character_id,
                "name": name,
                "category": category,
                "sourceRange": [start, end],
                "paragraphs": paragraphs,
                "relations": relation_map[character_id],
            }
        )

    appendix = {
        "id": "combat-ranking",
        "name": by_index[594]["text"],
        "titleIndex": 594,
        "paragraphs": [by_index[index] for index in range(595, 700) if index in by_index],
    }
    archive = {
        "source": source["source"],
        "sourceSha256": source["docxSha256"],
        "pdfSha256": source["pdfSha256"],
        "categories": CATEGORIES,
        "characters": records,
        "relationshipNodes": RELATIONSHIP_NODES,
        "relationshipEdges": RELATIONSHIP_EDGES,
        "appendices": [appendix],
    }
    json_text = json.dumps(archive, ensure_ascii=False, indent=2)
    output = (
        "const CHARACTER_ARCHIVE = " + json_text + ";\n\n"
        "if (typeof module !== 'undefined' && module.exports) {\n"
        "  module.exports = { CHARACTER_ARCHIVE };\n"
        "}\n\n"
        "if (typeof window !== 'undefined') {\n"
        "  window.CHARACTER_ARCHIVE = CHARACTER_ARCHIVE;\n"
        "}\n"
    )
    OUTPUT.write_text(output, encoding="utf-8")
    print(f"wrote {len(records)} character records to {OUTPUT}")


if __name__ == "__main__":
    main()
