/** Fixed, local teaching assets. Each clip corresponds to one real lab step. */
export const actionFilms = {
  'close-switch': {
    title: '合上开关',
    action: '点左前方的开关手柄，把刀闸合上。',
    watch: '右侧检流计先向一侧偏转；开关不动时，指针会回零。',
    next: '等指针回零、记录增加，再抬起开关。',
    label: '合闸',
  },
  'open-switch': {
    title: '抬起同一个开关',
    action: '再点一次开关手柄，或把它向上抬起。',
    watch: '断开时指针朝接通时的反方向偏转，然后回零。',
    next: '等第三条记录出现，再比较通断的两条曲线。',
    label: '断开',
  },
  'overlay-traces': {
    title: '把两条曲线叠起来',
    action: '把「断开瞬间」拖到「接通瞬间」上；也可以按这个顺序点两张记录。',
    watch: '叠在同一条零线上，一条往上，一条往下。',
    next: '曲线叠合后，电池会亮起；只反转电池。',
    label: '叠曲线',
  },
  'flip-battery': {
    title: '只反转电池',
    action: '开关断开时，点电池，交换电池的正负接法。',
    watch: '看电池旁的 ＋ / − 交换；开关、铁环和两组线圈保持原样。',
    next: '极性翻转后，合上同一个开关做对照。',
    label: '换极性',
  },
  'close-reversed': {
    title: '换了电池方向，再合闸',
    action: '合上原来那只开关，其他地方都不动。',
    watch: '和第一次合闸比较：现在指针往反方向摆。',
    next: '等指针再一次回零，再抬起开关。',
    label: '反接合闸',
  },
  'open-reversed': {
    title: '反接后，再断开',
    action: '抬起同一个开关，保持电池反接。',
    watch: '同一极性下，断开时的偏转与接通时相反。',
    next: '收齐六条观察，再点铁环看现代磁场示意。',
    label: '反接断开',
  },
  'magnet-approach': {
    title: '沿导轨靠近线圈',
    action: '按住磁铁上的手形，沿轨道拖到线圈旁的靠近位。',
    watch: '磁铁在动，检流计向一侧摆；这套装置没有电池。',
    next: '靠近记录出现后，原地松手，先别拖回去。',
    label: '拖向线圈',
  },
  'magnet-hold': {
    title: '靠近以后，松手不动',
    action: '把磁铁留在线圈旁，松开鼠标或手指。',
    watch: '磁铁仍在近处，指针却回到零位。',
    next: '等观察条走满、停住记录出现，再把磁铁拉远。',
    label: '松手停住',
  },
  'magnet-away': {
    title: '沿原路把磁铁拉远',
    action: '按住同一根磁铁，沿原轨道拖回远端。',
    watch: '和靠近时比较：指针朝反方向摆。',
    next: '第三条记录出现后，就能带着证据进密室，也可再试快慢。',
    label: '拖回远处',
  },
} as const;

export type ActionFilmId = keyof typeof actionFilms;

export const ringActionFilms = {
  ready: 'close-switch',
  steady: 'open-switch',
  compare: 'overlay-traces',
  flip: 'flip-battery',
  'reverse-ready': 'close-reversed',
  'reverse-steady': 'open-reversed',
} as const satisfies Record<string, ActionFilmId>;

export const magnetActionFilms = {
  approach: 'magnet-approach',
  hold: 'magnet-hold',
  away: 'magnet-away',
} as const satisfies Record<string, ActionFilmId>;
