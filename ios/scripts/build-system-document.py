from pathlib import Path
import json, shutil, argparse
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.text import WD_ALIGN_PARAGRAPH
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--output-dir',type=Path,default=ROOT/'docs');args=parser.parse_args()
OUT=args.output_dir
OUT.mkdir(parents=True,exist_ok=True)
contract=json.loads((ROOT/'docs/system-contract.json').read_text())
doc=Document();sec=doc.sections[0]
sec.page_width=Inches(8.5);sec.page_height=Inches(11)
sec.top_margin=Inches(.72);sec.bottom_margin=Inches(.7)
sec.left_margin=sec.right_margin=Inches(.78)
for name,size in [('Normal',10.5),('Title',27),('Subtitle',14),('Heading 1',18),('Heading 2',13),('Heading 3',11)]:
 s=doc.styles[name];s.font.name='Arial Unicode MS';s.font.size=Pt(size);s.font.color.rgb=RGBColor(0,0,0)
 s.element.get_or_add_rPr().rFonts.set(qn('w:eastAsia'),'Arial Unicode MS')
 s.paragraph_format.line_spacing=1.2;s.paragraph_format.space_after=Pt(7)
 s.paragraph_format.keep_with_next=name.startswith('Heading')
 for borders in list(s.element.xpath('.//w:pBdr')):borders.getparent().remove(borders)
def p(t='',bold=False):
 a=doc.add_paragraph();a.add_run(t).bold=bold;return a
def h(t):return doc.add_heading(t,2)
def page(t):
 a=doc.add_heading(t,1);a.paragraph_format.page_break_before=True
def table(headers,rows,widths):
 t=doc.add_table(rows=1,cols=len(headers));t.autofit=False
 for c,w in zip(t.columns,widths):c.width=Inches(w)
 for i,v in enumerate(headers):t.rows[0].cells[i].text=str(v)
 for row in rows:
  for c,v in zip(t.add_row().cells,row):c.text=str(v)
 for j,row in enumerate(t.rows):
  row._tr.get_or_add_trPr().append(OxmlElement('w:cantSplit'))
  for i,c in enumerate(row.cells):
   c.width=Inches(widths[i]);pr=c._tc.get_or_add_tcPr()
   borders=OxmlElement('w:tcBorders')
   for side in ['top','left','bottom','right','insideH','insideV']:
    e=OxmlElement('w:'+side);e.set(qn('w:val'),'single');e.set(qn('w:sz'),'4');e.set(qn('w:color'),'D9D9D9');borders.append(e)
   pr.append(borders);shade=OxmlElement('w:shd');shade.set(qn('w:fill'),'243A46' if j==0 else 'F1F4F4' if j%2==0 else 'FFFFFF');pr.append(shade)
   mar=OxmlElement('w:tcMar')
   for side in ['top','bottom','left','right']:
    e=OxmlElement('w:'+side);e.set(qn('w:w'),'70');e.set(qn('w:type'),'dxa');mar.append(e)
   pr.append(mar)
   for a in c.paragraphs:
    a.paragraph_format.space_after=Pt(2);a.paragraph_format.line_spacing=1.12
    for r in a.runs:r.font.size=Pt(9);r.bold=j==0;r.font.color.rgb=RGBColor.from_string('FFFFFF' if j==0 else '000000')
 t.rows[0]._tr.get_or_add_trPr().append(OxmlElement('w:tblHeader'))
 p()

doc.add_paragraph('时间迷雾 iOS 系统分析文档',style='Title')
doc.add_paragraph('电磁感应首章架构 接口和实现约束',style='Subtitle')
p('版本 V1.0    2026 年 11 月 18 日')
h('系统决策')
p('以原生 SwiftUI 实现 iPhone 科学历险，最低 iOS 17。首版完整覆盖感应环六次观察、磁铁靠近停住远离、三项证据检验、十次奖励、收藏与历史、离线恢复和易用性设置。使用一个独立 Swift Package 承载科学模型与领域规则，界面和演出不能绕过证据校验。')
p('首版没有后端、账户、云同步或支付。本文的接口是实际可编译的 Swift 模块接口，不制造尚不存在的 HTTP 服务。未来接入服务端时，沿用记录 UUID、版本和事件去重键，另行定义同步协议。')
h('给开发和测试的阅读路径')
p('先核对模块边界和状态机，再看观察样本、证据判定、奖励事务与错误恢复。接口 I01 到 I08 对应源代码职责；验收表描述需要运行的测试。本文与同目录 system-contract.json 共同构成实现基线，最终执行结果另附验收记录。')

page('01 需求映射和实现边界')
table(['需求','本次实现','主要模块'],[
 ('F01 F02','三个根入口、章节地图、灯塔任务和续玩','SwiftUI 导航与 AppModel'),
 ('F03 F05','原始轨迹驱动的感应环六观察和公平对照','RingPhysics 和 ChapterEngine'),
 ('F04 F09 F11','研究星、工具、印章、灯塔、收藏和证据追溯','RewardEntry 和 RewardDefinition'),
 ('F06 F07','可控动作 GIF、拖磁铁和等价点按、静止观察','HelpFilmView 和原生仪器画布'),
 ('F08','解释迷雾、胶片配对、时间光标、具体错误提示','EvidenceJudge'),
 ('F10 F12','历史摘要、真实来源索引、设备验证后的外链','HistoryView 和 ParentAccess'),
 ('F13 F14','原子存档、坏档保护、中断恢复、动态文字和辅助操作','ProgressRepository 和系统环境')
],[1.25,3.5,2.19])
p('科学读数采用无量纲、刻意放慢的教学模型，不是校准仪表。装置几何来自现有项目的教学绘图。现代灯塔、助手与破雾是叙事；史料卡单独标明机构转述、教学改绘和原始出处。')
p('首版不包括其他物理化学章节、角色配音、社区、儿童行为上传、随机奖励或 App Store 发布。设备所有者验证不等于年龄、亲子身份或隐私同意；商店儿童类别及家长门槛的有效性仍需发布前专项评审。')

page('02 模块架构和依赖方向')
table(['模块','职责','允许依赖'],[(m['name'],m['responsibility'],' '.join(m['dependencies'])) for m in contract['modules']],[1.7,3.7,1.54])
p('依赖由界面指向协调器、由协调器指向独立核心和仓库。TimeFogCore 不导入 SwiftUI、UIKit、LocalAuthentication 或网络框架，能在 macOS 上直接运行单元测试。主 App 负责将触摸、系统生命周期与媒体播放状态转换成受限命令。')
p('观察帧由同一个模型对象生成，并同时供仪器绘制、读数显示和样本记录使用。物理模型不读奖励状态，GIF 不调用保存接口，奖励演出只读已经提交的 ChangeSet。')
h('命令处理顺序')
p('接收操作 → 校验当前步骤 → 推进模型或生成证据 → 核验证据与奖励 → 得到候选快照 → 原子保存 → 更新可观察状态 → 显示反馈。保存失败在发布成功状态之前终止，不改写已提交的内存快照。')

page('03 状态机和导航')
table(['阶段','进入动作','完成判定和下个检查点'],[
 ('感应环正接','合闸 观察保持 断开','每次独立完整窗口保存；进入叠图'),
 ('通断叠图','将同极性断开记录叠到接通记录','同装置和会话，通断响应反向；R03 后开放反接'),
 ('感应环反接','只反转电池，再做合闸 保持 断开','三条反接加三条正接真实记录齐备'),
 ('极性对照','装入相同动作的两份记录，调关键帧','只极性不同且两针反向；R04 后解锁工具'),
 ('磁铁实验','远端靠近 近端停住 原路远离','各段保存，完整同会话周期解锁解释关'),
 ('三项解释关','配证据 调光标 定格','分别重算震动 漏电 持续电流说的判定'),
 ('完成与历史','十事件齐备','点亮灯塔，收藏与真实历史可重访')
],[1.3,2.6,3.04])
p('根入口为历险、收藏、我的。实验进入独立导航栈，当前阶段只有一个主要动作。离开前说明完整观察已保存；恢复时从最近检查点开始。返回不通过页面索引跳到尚未满足的下一关。重玩只重置当前实验会话和步骤，保留原始获奖证据和账本。')

page('04 领域数据和版本')
table(['对象','关键字段','约束'],[
 ('ScienceFrame','closed position flux signal needle','有限数值，位置 0 到 1，指针负 1 到 1'),
 ('Sample','time 和 ScienceFrame','观察内相对秒；严格递增；不使用 Date 差计观察'),
 ('ExperimentRecord','id runID kind action polarity configuration samples modelVersion','个人真实操作；完整窗口；固定装置配置'),
 ('EvidenceProof','kind evidenceIDs checkpoint batteryRemoved','记录存在且重新判定通过，光标 0 到 1'),
 ('RewardEntry','eventID earnedAt evidenceIDs proof','eventID 唯一；分值和原因由固定配置计算'),
 ('AppSnapshot','schemaVersion contentVersion runID step observations proofs rewards preferences','单份事务快照，不分表先后保存'),
 ('Preferences','reduceMotion haptics sound largeText tapAssist','帮助与辅助设置不得改变奖励金额')
],[1.25,3.2,2.49])
p('chapterID 固定为 induction-1831；schemaVersion 和 contentVersion 初始为 1。UUID 只标识本地记录，不是账户。时间戳用于收藏排序，不用来授予观察时长。奖励账本不存储可由界面覆盖的总星数，总数永远由合法事件集合求和。')
p('记录仅存模型量与操作，无姓名、生日、定位、相机或麦克风。加载时校验版本、枚举、数量、时间、数值和引用；本地 JSON 不是防破解的服务端证明，首版目标是避免误发与数据损坏。')

page('05 科学模型接口')
for api in contract['interfaces'][:2]:
 h(api['id']+' '+api['name']);p('输入 '+api['input']);p('输出 '+api['output']);p('失败处理 '+api['errors'])
h('感应环的时间约定')
p('合闸的机械行程约 0.28 秒，在接触前保持零电流响应；接触后的磁通量用指数变化，电动势来自磁通量的负时间导数。指针采用先上升后衰减的阻尼响应。完整瞬态窗口为机械行程加 2.8 秒，保持窗口不少于 1.5 秒。断开与接通符号相反，电池反接再次反转符号。')
p('保持供电只意味着原边回路仍接通，不意味着次级持续有电流。图中正负方向固定由检流计接线约定；不得一会儿按图上左右、一会儿按磁场线方向改号。')
h('磁铁的空间约定')
p('目标位置 0 表示远端，1 表示近端；轨道不穿越线圈中心。单调轴向磁通量由位置计算，有限差分给出响应，指针再经阻尼。拖动、滑杆与点按只设置目标位置，统一经过跟随模型限速后产生真实样本。中途停住必须真实衰减，不播放预设完整脉冲。')

page('06 证据记录接口和校验')
api=contract['interfaces'][2];h(api['id']+' '+api['name']);p('输入 '+api['input']);p('输出 '+api['output']);p('拒绝 '+api['errors'])
p('感应环样本与相同动作、极性和时间的模型重算结果一致，末尾覆盖完整窗口且回零。磁铁样本的前一位置与下一位置决定磁通量差和信号，再重算针偏，不能直接接受外部给出的 peak。')
table(['观察','必需条件','不接受'],[
 ('靠近','起点小于 0.025，终点大于 0.975，正向响应，轨迹完整','只改变终点或伪造峰值'),
 ('近处停住','各采样位置均近端，零信号与稳定指针持续至少 1.5 秒','远处零 或未稳定瞬间'),
 ('远离','同会话近到远，响应负向，前两段存在','不同磁极 接线或会话拼接')
],[1.1,3.65,2.19])
p('最多 128 份存档记录、每份最多 1200 样本。快照压缩保留所有获奖和证明引用，再保留当前会话与最新记录。不能为了控制体积删掉方法印章仍引用的证据。错误记录不入账，提示指出缺失动作或条件。')

page('07 解释检验接口')
api=contract['interfaces'][3];h(api['id']+' '+api['name']);p('输入 '+api['input']);p('输出 '+api['output'])
table(['解释','选择校验','关键帧校验'],[
 ('纯震动','两条感应环记录除极性外相同，动作相同且不是保持','两指针乘积小于负阈值，说明方向确实相反'),
 ('漏电必要性','无电池磁铁运动记录，移走解释中的电池标记成立','运动帧针偏大于自身峰值的一定比例'),
 ('有磁铁就持续有电流','同会话靠近 停住 远离三段齐备','光标在中段，近端位置和非零磁通量仍在，指针归零')
],[1.25,3.0,2.69])
p('证明的作用范围必须读得出来：排除当前纯震动解释，不声称一切机械影响均不可能；说明现象不一定需要漏电，不宣称任何仪器都不会漏电。近端零结果表明此条件下没有持续响应，不把未检出写成永远不存在。')
p('不公平对照逐项列出改变了什么。缺记录回到对应操作，保留其余星数。界面最多显示当前所需的几份候选记录，不恢复为巨大列表。慢放到关键帧是免费辅助，仍使用个人记录并重新判定。')

page('08 命令接口和事务')
api=contract['interfaces'][4];h(api['id']+' '+api['name']);p('输入 '+api['input']);p('输出 '+api['output']);p('拒绝 '+api['errors'])
table(['命令族','前置条件','结果'],[
 ('开始或继续','存档有效，目标阶段可进入','持久化安全检查点'),
 ('record','动作与当前阶段一致，观察验证通过','追加记录，可能奖励，推进一步'),
 ('overlay','本轮同极性通断记录有效','R03，只推进一次'),
 ('compare','六观察和公平对照关键帧有效','R04，工具开放'),
 ('prove','前序解释完成，当前证据和光标有效','R08 到 R10，一次性方法印章'),
 ('replay','已获证据保留','新的 runID 和起点，账本不清零'),
 ('preferences','仅允许定义的布尔设置','保存辅助偏好，无奖励变化')
],[1.1,3.4,2.44])
p('AppModel 不在界面变更后补存档。它先把候选快照交给仓库；仓库成功后替换 engine 和 visibleState，再触发触觉与奖励卡。若写入失败，候选 ChangeSet 保留在内存，重试保存相同快照，期间屏蔽新推进。程序被终止时仍可从上一次已提交检查点重做，不虚报成功。')

page('09 奖励账本和解锁')
table(['事件','研究星','验证条件'],[(r['id'],r['stars'],r['condition']) for r in contract['rewards']],[.65,.65,5.64])
p('合计 100 星。R04 解锁回放对照镜；R08、R09、R10 分别对应控制变量、排除替代解释、保存零结果的方法印章。章末修复灯塔、授予发现者称号，不再额外加星。重复成功显示已获得，不重新播放虚假增量。')
p('0 到 39 星为观察学徒，40 到 99 为证据侦探，100 为发现者；当前配置第一次跨门槛是在 45 星。提示、GIF、点按辅助、关闭声音、重试均不降低称号。研究星不是电能、不兑换钱、不会消耗。')

page('10 存档协议和恢复')
api=contract['interfaces'][5];h(api['id']+' '+api['name']);p('输入 '+api['input']);p('输出 '+api['output']);p('失败 '+api['errors'])
p('固定位置为应用私有 Application Support 下的 TimeFog/progress.json。save 将完整合法快照编码为 JSON，使用 Foundation 原子写入：先辅助文件，成功后替换原文件。单一主线程协调器序列化命令，避免并发旧快照覆盖新结果。')
table(['情况','行为'],[
 ('首次启动且文件不存在','创建默认快照，开始前先确认能写入'),
 ('解码或引用无效','保留文件，阻止新进展，显示重读或家长确认清档'),
 ('未来 schemaVersion','提示版本不支持，不尝试覆盖未知数据'),
 ('写入失败','保留已提交快照与候选，重试同一事务'),
 ('已完成观察后重启','恢复已保存的阶段与账本，不再次发奖'),
 ('半次观察后终止','从该动作安全起点重做，不把半段补成证据')
],[2.0,4.94])
p('不把删除 App 后可恢复作为首版承诺；没有云端恢复。用户主动清档必须设备验证、二次确认，再原子写入空白快照。坏档恢复保留原始文件副本，避免无法找回问题记录。')

page('11 时钟和生命周期')
api=contract['interfaces'][6];h(api['id']+' '+api['name']);p('输入 '+api['input']);p('输出 '+api['output'])
p('使用单调显示时钟，每帧只累计有限的模拟时间增量。长帧不补入数秒观察；模型与轨迹共用同一 delta。App 非 active、示范弹层或主动暂停时停止推进。回到 active 重设时钟基点；不能通过切后台等待获得近处零结果。')
p('打开示范或奖励详情冻结当前样本窗口，不改变实验。切入后台则取消未完成段，从当前检查点的安全位置恢复：合闸前开关打开，断开前开关接通；磁铁靠近从远端开始，停住与远离从近端开始。已经完成的前一段和同次会话仍保存。')
p('用户把磁铁拖离近端会重置静止计时，移回后重新等待稳定；已获得 R05 不撤销。拖动取消不自动补完移动。点按辅助同样通过模型移动并采样，不能直接生成记录。')

page('12 界面与装置呈现')
p('原生 Canvas 绘制已有装置的矢量几何。静态路径预解析并缓存，磁铁按同一 position 平移，遮挡顺序随几何深度排序；检流计针按模型 needle 旋转。开关姿态与模型 closed 共享进度，避免接触前指针先偏转。')
p('仪器画布提供直接开关点按和磁铁拖动，底部大按钮、位置滑杆与辅助点按为等价入口。读数放大和慢看从第一步可用；奖励对照镜增加的是多记录同步便利能力。每一步显示一个目标、一个主要操作、完成信号和下一步去向。')
p('成功反馈在证据附近出现，明示发现名称、奖励增量与已有总数。新工具展示用途，方法印章可回看证据。奖励卡不会遮挡仍在发生的瞬态；完整观察结束后可展开卡片，跳过演出不丢奖励。')
p('正文使用系统可缩放字体，主要按钮至少 54 pt 高，其他主要触控区以 44 pt 为目标。页面可滚动，不以缩小正文塞满固定画布。VoiceOver 的对象有名称、当前值与操作提示；指针读数提供稳定文字描述，避免每帧播报。Reduce Motion 使用静态状态替代飞星和位移庆祝；GIF 默认停在静帧，由用户主动播放。')

page('13 媒体和历史资料')
p('动作 GIF 属于只读教学资源，含合闸、断开、反转电池、反接后通断、磁铁靠近停住远离与叠图。媒体播放组件与实验控制器分离，返回后恢复相同步骤。播放、停止或重播都不调用观察保存。媒体失败显示文字等价说明，允许继续真实操作。')
p('首章历史档案以问题、反复尝试、感应环、无电池现象、装置扩展、公开交流组织。不伪造未核验的原始引文或精确日期；明确核验的 1831 年 8 月 29 日感应环节点链接英国皇家研究院。尚未完成全文审校的手稿页只作为外部索引，不展示虚构扫描。')
p('藏品、教学改绘、现代游戏演出采用不同标签。真实历史阅读不发研究星、不强迫打开外链、不影响通关；事实边界说明何处支持装置与背景，何处仍需实验推理。')

page('14 家长区和数据安全')
api=contract['interfaces'][7];h(api['id']+' '+api['name']);p('输入 '+api['input']);p('结果 '+api['output']);p('失败 '+api['errors'])
p('使用 LocalAuthentication 的设备所有者验证，允许系统生物识别或设备密码回退。每次外链和清档分别验证，不保存密码、脸部数据或可复用的已验证角色。没有设置设备验证、用户取消或失败时，仍可留在应用读史料摘要，学习不被锁住。')
p('外部来源只取代码内明确登记的 HTTPS 机构链接，不接受用户输入任意 URL。应用进入后台时清除未使用的危险操作请求；外链验证后必须仍是同一请求且应用活跃。清档还要求明确二次确认。')
p('设备验证只确认设备解锁权限，不证明操作者是家长、不识别年龄、不替代同意。原生 App 功能实现与儿童类别发布审查分开；发布前必须用真实家庭设备验证门槛是否达到产品和平台要求。')
p('首版无登录服务、广告或行为追踪 SDK，不索取相机、麦克风、联系人或定位。日志只记录一般错误，不打印原始存档、凭据或身份信息。测试专用重置启动参数仅在 DEBUG 构建中可用，Release 不具备绕过入口。')

page('15 错误契约和可恢复性')
table(['错误','用户可见反馈','恢复'],[
 ('invalidStep','先完成当前动作','停留该步，不产生奖励'),
 ('invalidObservation','观察尚未完整或条件发生改变','说明缺哪个窗口，重做当前段'),
 ('missingEvidence','缺少某一记录','回对应实验补做'),
 ('unfairComparison','具体列出动作或装置同时改变','保留有效胶片，只换不公平的一份'),
 ('notAtCheckpoint','现在还看不清这条证据','拖光标或免费慢放到有效帧'),
 ('corruptStore','已有存档暂时无法读取','保留文件，重试或家长清档'),
 ('unsupportedVersion','存档来自较新版本','不写入，等待兼容版本'),
 ('ioFailure','这次保存没有完成','保留候选并重试，不宣布奖励到账'),
 ('authCancelled','留在 App 继续阅读','不打开外站，不清档')
],[1.5,2.85,2.59])

page('16 测试和交付验收')
table(['层次','必须覆盖'],[
 ('模型单元测试','接触前零、反接反向、保持零、磁通与响应一致、停止归零、非有限输入'),
 ('证据与状态机','短窗口拒绝、时间倒序拒绝、伪造值拒绝、混杂条件、近端零、跨会话拼接拒绝'),
 ('奖励与事务','十事件 100 星、重复证明不加星、重玩不清账、写失败不发布、重试一次入账'),
 ('存档','往返读取、未知版本、坏 JSON、非法引用、保留已有记录、清档副本'),
 ('iPhone UI','完整首章、拖动或点按磁铁、错误对照提示、关键帧操作、收藏追溯、重启续玩'),
 ('环境和演出','后台不加观察、示范不发星、减弱动态、大字、GIF 缺失回退、按钮可达')
],[1.8,5.14])
p('测试不调用一个直接授予 100 星的测试后门。集成测试向真实物理模型输入动作，生成样本，再通过与界面相同的领域命令。UI 测试以真实操作流程完成观察窗口；测试重置只隔离存档，不跳过科学判定。')
p('交付包含 Xcode 工程、独立核心包、核心与 UI 测试、固定资源、接口契约、系统分析文档、运行说明和实际验证记录。未完成的真机签名、商店审核或儿童实测必须与已经通过的编译测试分开记录。')

page('17 参考依据和后续扩展')
refs=[
 ('Apple SwiftUI Managing model data in your app','Observation 与界面模型分离，iOS 17 可用','https://developer.apple.com/documentation/swiftui/managing-model-data-in-your-app'),
 ('Apple Foundation WritingOptions atomic','先辅助文件后替换的写入语义','https://developer.apple.com/documentation/foundation/nsdata/writingoptions/atomic'),
 ('Apple LocalAuthentication','设备验证能力检查、系统验证与取消行为','https://developer.apple.com/documentation/localauthentication/logging-a-user-into-your-app-with-face-id-or-touch-id'),
 ('Royal Institution Faraday ring coil apparatus','1831 年 8 月 29 日发现背景与藏品材料','https://www.rigb.org/explore-science/explore/collection/michael-faradays-ring-coil-apparatus')
]
for title,scope,url in refs:
 p(title,True);p(scope);a=p(url)
 for r in a.runs:r.font.size=Pt(9)
p('访问核验日期为 2026 年 11 月 18 日。实现基线为本项目现有感应环和磁铁模型、2026 年 11 月 17 日 PRD 和 UED；无量纲时间尺度、阈值和数值容差是教学实现参数，需要科学审校和儿童测试继续校准。')
p('新增章节通过独立内容 ID、模型和奖励配置扩展，不在现有 eventID 中混入新奖励。云同步需新增设备冲突合并、上传同意和服务端去重；本版只预留 UUID 和版本，不提前建设空后端。')

doc.core_properties.title='时间迷雾 iOS 系统分析文档'
doc.core_properties.subject='首章系统架构和接口契约'
footer=sec.footer.paragraphs[0];footer.alignment=WD_ALIGN_PARAGRAPH.RIGHT
r=footer.add_run('时间迷雾 iOS 系统分析 V1.0   ');r.font.size=Pt(8)
f=OxmlElement('w:fldSimple');f.set(qn('w:instr'),'PAGE');footer._p.append(f)
target=OUT/'时间迷雾iOS系统分析文档.docx';doc.save(target)
if target.resolve() != (ROOT/'docs'/target.name).resolve():shutil.copy2(target,ROOT/'docs'/target.name)
if (ROOT/'docs/system-contract.json').resolve() != (OUT/'system-contract.json').resolve():shutil.copy2(ROOT/'docs/system-contract.json',OUT/'system-contract.json')
print(target)
