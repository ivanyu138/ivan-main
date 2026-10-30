export const ITEMS = {
  soda: { name: 'Soda', desc: '+25 HP', use: (g) => g.rpg.heal(25) },
  coffee: { name: 'Coffee', desc: 'Speed boost for 10s', use: (g) => (g.rpg.boostT = Math.max(g.rpg.boostT, 10)) },
  energy: { name: 'Energy Drink', desc: 'Speed boost for 25s', use: (g) => (g.rpg.boostT = Math.max(g.rpg.boostT, 25)) },
  bandage: { name: 'Bandage', desc: '+60 HP', use: (g) => g.rpg.heal(60) },
  pie: { name: 'Cherry Pie', desc: '+40 HP', use: (g) => g.rpg.heal(40) },
  pizza: { name: 'Pizza Slice', desc: '+35 HP', use: (g) => g.rpg.heal(35) },
  burger: { name: 'Burger', desc: 'Full heal', use: (g) => g.rpg.heal(9999) },
  treats: { name: 'Cat Treats', desc: '+30 HP', use: (g) => g.rpg.heal(30) },
};

export const SHOPS = {
  mart: { title: 'Corner Bodega', stock: [{ item: 'soda', price: 5 }, { item: 'energy', price: 14 }, { item: 'bandage', price: 22 }] },
  diner: { title: "Lou's Diner", stock: [{ item: 'coffee', price: 4 }, { item: 'pie', price: 10 }, { item: 'burger', price: 18 }] },
  pizza: { title: "Tony's Pizza", stock: [{ item: 'pizza', price: 8 }] },
  clinic: { title: 'St. Mercy Clinic', stock: [{ service: 'heal', label: 'Full treatment', price: 30 }] },
  gym: {
    title: 'Iron Gym',
    stock: [
      { service: 'train_strength', label: 'Strength training (+1 STR)', price: 120 },
      { service: 'train_stamina', label: 'Cardio class (+1 Speed)', price: 120 },
    ],
  },
  garage: {
    title: "Vic's Garage",
    stock: [
      { service: 'repair', label: 'Repair your car (park it out front)', price: 40 },
      { service: 'buy_sedan', label: 'Buy a used sedan', price: 400 },
      { service: 'buy_sports', label: 'Buy the "Comet" sports car', price: 1500 },
    ],
  },
};

export const SKILLS = {
  strength: { name: 'Strength', desc: 'Punch damage' },
  stamina: { name: 'Speed', desc: 'Sprint speed' },
  driving: { name: 'Driving', desc: 'Top speed and handling' },
  charisma: { name: 'Charisma', desc: 'Shop discounts and quest pay' },
};
export const SKILL_MAX = 10;

export class RPG {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.level = 1;
    this.xp = 0;
    this.money = 40;
    this.maxHp = 100;
    this.hp = 100;
    this.rep = 0;
    this.skillPoints = 0;
    this.skills = { strength: 1, stamina: 1, driving: 1, charisma: 1 };
    this.inventory = { soda: 2 };
    this.gnomes = [];
    this.cat = 'ginger';
    this.fishGiven = 0;
    this.socksSold = 0;
    this.stash = [];
    this.boostT = 0;
  }

  get xpNext() {
    return Math.round(100 * Math.pow(this.level, 1.4));
  }

  addXP(n) {
    const g = this.game;
    this.xp += n;
    g.ui.toast(`+${n} XP`, '#9fd0ff');
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.skillPoints++;
      this.maxHp += 10;
      this.hp = this.maxHp;
      g.ui.toast(`LEVEL UP! You are now level ${this.level}`, '#ffd34d');
      g.ui.toast('+1 skill point (press C)', '#ffd34d');
      g.sfx.play('levelup');
    }
  }

  addMoney(n) {
    this.money += n;
    this.game.ui.toast(`+$${n}`, '#8fe27a');
  }

  priceOf(base) {
    return Math.max(1, Math.round(base * (1 - Math.min(0.3, (this.skills.charisma - 1) * 0.04)) * (this.rep < -20 ? 1.25 : 1)));
  }

  payMult() {
    return 1 + (this.skills.charisma - 1) * 0.06;
  }

  damage(n) {
    const g = this.game;
    if (g.dead) return;
    this.hp -= n;
    g.ui.flash(Math.min(0.35, 0.1 + n * 0.03));
    if (this.hp <= 0) {
      this.hp = 0;
      g.die();
    }
  }

  heal(n) {
    this.hp = Math.min(this.maxHp, this.hp + n);
  }

  update(dt) {
    this.boostT = Math.max(0, this.boostT - dt);
  }

  addItem(id, n = 1) {
    this.inventory[id] = (this.inventory[id] || 0) + n;
  }

  useItem(id) {
    if (!this.inventory[id]) return false;
    ITEMS[id].use(this.game);
    if (--this.inventory[id] <= 0) delete this.inventory[id];
    this.game.ui.toast(`Used ${ITEMS[id].name}`, '#cfe8b0');
    this.game.sfx.play('use');
    return true;
  }

  spendSkill(key) {
    if (this.skillPoints <= 0 || this.skills[key] >= SKILL_MAX) return false;
    this.skillPoints--;
    this.skills[key]++;
    return true;
  }

  serialize() {
    const { level, xp, money, maxHp, hp, rep, skillPoints, skills, inventory, gnomes, cat, fishGiven, socksSold } = this;
    const stash = this.game.stash ? this.game.stash.kinds : this.stash;
    return { level, xp, money, maxHp, hp, rep, skillPoints, skills, inventory, gnomes, cat, fishGiven, socksSold, stash };
  }

  load(d) {
    const { stamina, ...rest } = d;
    Object.assign(this, rest);
  }
}
