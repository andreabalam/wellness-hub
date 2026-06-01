export interface Recipe {
  id?: number
  cat: string
  type: string
  color: string
  sc: string
  name: string
  tag: string
  prepL: string
  prepC: string
  /** Approximate prep/cook time shown on the card badge, e.g. "15 min", "30 min" */
  prepTime?: string
  /** Explicit health classification for the badge */
  healthTag?: 'healthy' | 'indulgent'
  /** Optional image URL shown when the card is expanded */
  image?: string
  /** Optional recipe source / reference URL shown when the card is expanded */
  link?: string
  hk: number
  hp: string
  hc: string
  hf: string
  hfi?: string
  mk: number
  mp: string
  mc: string
  mf: string
  ings: [string, string][]
  steps: string[]
  tip: string
  custom?: boolean
  /** Who created this recipe: 'builtin' | 'dr_emily' | 'user' */
  source?: 'builtin' | 'dr_emily' | 'user'
  /**
   * DB id of the built-in recipe this was forked from.
   * Set when the user edits a default recipe — the original stays untouched.
   */
  defaultId?: number
  /**
   * When true, this default recipe is hidden for this user.
   * Hidden defaults do not appear in the recipe list but can be restored.
   */
  hidden?: boolean
}

export const PRESET_CATS = ['breakfast', 'smoothie', 'lunch', 'dinner', 'dessert', 'ferments', 'snack', 'drinks', 'sauce', 'side']

/**
 * One default recipe per category, chosen by best protein-to-calorie ratio.
 * Breakfast=2, Smoothie=5, Lunch=9, Dinner=13, Dessert=22, Ferments=24, Snack=45.
 * (No Drinks recipe is currently in the DB.)
 */
export const DEFAULT_RECIPE_IDS = [2, 5, 9, 13, 22, 24, 45] as const

/**
 * Static fallback recipe list — shown when Supabase is unavailable (local dev / E2E tests).
 * The real built-in catalog lives in the `recipes` DB table; this is a representative subset
 * so the UI is never left empty offline.
 */
export const BUILTIN_RECIPES: Recipe[] = [
  // ── Breakfast ──────────────────────────────────────────────────────────────
  {
    cat: 'breakfast', type: 'Breakfast', color: 'var(--amber)', sc: 'am',
    name: 'Overnight Oats', tag: 'High fibre · no cook',
    prepL: '5 min', prepC: 'var(--amber)', prepTime: '5 min', healthTag: 'healthy',
    hk: 380, hp: '14', hc: '58', hf: '9', hfi: '7',
    mk: 320, mp: '12', mc: '48', mf: '7',
    ings: [['Rolled oats', '80g'], ['Milk or plant milk', '200ml'], ['Chia seeds', '1 tbsp'], ['Honey', '1 tsp']],
    steps: ['Combine oats, milk and chia seeds in a jar.', 'Stir well, cover and refrigerate overnight.', 'Top with fruit and honey before serving.'],
    tip: 'Add a scoop of protein powder for an extra protein boost.',
    source: 'builtin',
  },
  {
    cat: 'breakfast', type: 'Breakfast', color: 'var(--amber)', sc: 'am',
    name: 'Avocado Toast', tag: 'Quick · healthy fats',
    prepL: '10 min', prepC: 'var(--amber)', prepTime: '10 min', healthTag: 'healthy',
    hk: 350, hp: '10', hc: '34', hf: '20', hfi: '8',
    mk: 290, mp: '8', mc: '28', mf: '16',
    ings: [['Sourdough bread', '2 slices'], ['Ripe avocado', '1 medium'], ['Lemon juice', '1 tsp'], ['Chilli flakes', 'pinch']],
    steps: ['Toast the bread.', 'Mash avocado with lemon juice and salt.', 'Spread on toast and season with chilli flakes.'],
    tip: 'Top with a poached egg for extra protein.',
    source: 'builtin',
  },
  {
    cat: 'breakfast', type: 'Breakfast', color: 'var(--amber)', sc: 'am',
    name: 'Greek Yogurt Parfait', tag: 'High protein · quick',
    prepL: '5 min', prepC: 'var(--amber)', prepTime: '5 min', healthTag: 'healthy',
    hk: 320, hp: '22', hc: '40', hf: '6',
    mk: 260, mp: '18', mc: '32', mf: '4',
    ings: [['Greek yogurt', '200g'], ['Granola', '30g'], ['Mixed berries', '80g'], ['Honey', '1 tsp']],
    steps: ['Layer yogurt in a glass.', 'Add granola and berries.', 'Drizzle with honey.'],
    tip: 'Use full-fat yogurt for a creamier texture.',
    source: 'builtin',
  },
  {
    cat: 'breakfast', type: 'Breakfast', color: 'var(--amber)', sc: 'am',
    name: 'Scrambled Eggs & Spinach', tag: 'High protein · 10 min',
    prepL: '10 min', prepC: 'var(--amber)', prepTime: '10 min', healthTag: 'healthy',
    hk: 280, hp: '20', hc: '4', hf: '19',
    mk: 230, mp: '17', mc: '3', mf: '15',
    ings: [['Eggs', '3 large'], ['Baby spinach', '40g'], ['Butter', '1 tsp'], ['Salt & pepper', 'to taste']],
    steps: ['Whisk eggs with a pinch of salt.', 'Melt butter in a pan over medium heat.', 'Add eggs and stir gently.', 'Fold in spinach just before eggs set.'],
    tip: 'Low heat is the secret to creamy scrambled eggs.',
    source: 'builtin',
  },
  {
    cat: 'breakfast', type: 'Breakfast', color: 'var(--amber)', sc: 'am',
    name: 'Banana Protein Pancakes', tag: 'Gluten-free option',
    prepL: '15 min', prepC: 'var(--amber)', prepTime: '15 min', healthTag: 'healthy',
    hk: 410, hp: '24', hc: '52', hf: '10',
    mk: 340, mp: '20', mc: '44', mf: '8',
    ings: [['Ripe banana', '1 large'], ['Eggs', '2 large'], ['Oat flour', '40g'], ['Baking powder', '½ tsp']],
    steps: ['Mash banana in a bowl.', 'Whisk in eggs and oat flour until smooth.', 'Cook spoonfuls on a non-stick pan 2 min each side.'],
    tip: 'Riper bananas make sweeter pancakes — no sugar needed.',
    source: 'builtin',
  },
  // ── Smoothies ──────────────────────────────────────────────────────────────
  {
    cat: 'smoothie', type: 'Smoothie', color: 'var(--green)', sc: 'gn',
    name: 'Green Detox Smoothie', tag: 'Low cal · alkalising',
    prepL: '5 min', prepC: 'var(--green)', prepTime: '5 min', healthTag: 'healthy',
    hk: 210, hp: '5', hc: '38', hf: '4',
    mk: 170, mp: '4', mc: '30', mf: '3',
    ings: [['Baby spinach', '60g'], ['Cucumber', '½ medium'], ['Green apple', '1 medium'], ['Ginger', '1 cm'], ['Water', '200ml']],
    steps: ['Add all ingredients to a blender.', 'Blend until smooth.', 'Serve immediately over ice.'],
    tip: 'Freeze the spinach in advance for a colder, thicker smoothie.',
    source: 'builtin',
  },
  {
    cat: 'smoothie', type: 'Smoothie', color: 'var(--green)', sc: 'gn',
    name: 'Berry Protein Blast', tag: 'High protein · antioxidants',
    prepL: '5 min', prepC: 'var(--green)', prepTime: '5 min', healthTag: 'healthy',
    hk: 330, hp: '28', hc: '38', hf: '6',
    mk: 280, mp: '24', mc: '32', mf: '5',
    ings: [['Mixed frozen berries', '150g'], ['Protein powder (vanilla)', '1 scoop'], ['Greek yogurt', '100g'], ['Almond milk', '150ml']],
    steps: ['Combine all ingredients in a blender.', 'Blend on high until creamy.', 'Adjust consistency with more milk.'],
    tip: 'Use frozen berries for a thick shake-like texture.',
    source: 'builtin',
  },
  {
    cat: 'smoothie', type: 'Smoothie', color: 'var(--green)', sc: 'gn',
    name: 'Mango Turmeric Smoothie', tag: 'Anti-inflammatory',
    prepL: '5 min', prepC: 'var(--green)', prepTime: '5 min', healthTag: 'healthy',
    hk: 260, hp: '6', hc: '52', hf: '4',
    mk: 210, mp: '5', mc: '44', mf: '3',
    ings: [['Frozen mango', '150g'], ['Banana', '1 small'], ['Turmeric', '¼ tsp'], ['Coconut milk', '150ml'], ['Black pepper', 'pinch']],
    steps: ['Blend all ingredients until smooth.', 'Taste and adjust sweetness.'],
    tip: 'Black pepper boosts turmeric absorption by up to 2000%.',
    source: 'builtin',
  },
  // ── Lunch ──────────────────────────────────────────────────────────────────
  {
    cat: 'lunch', type: 'Lunch', color: 'var(--teal)', sc: 'tl',
    name: 'Quinoa Buddha Bowl', tag: 'Vegan · complete protein',
    prepL: '20 min', prepC: 'var(--teal)', prepTime: '20 min', healthTag: 'healthy',
    hk: 480, hp: '18', hc: '64', hf: '16',
    mk: 400, mp: '15', mc: '54', mf: '13',
    ings: [['Quinoa', '80g dry'], ['Chickpeas', '100g tinned'], ['Cucumber', '½'], ['Cherry tomatoes', '80g'], ['Tahini dressing', '2 tbsp']],
    steps: ['Cook quinoa per packet instructions.', 'Drain and rinse chickpeas.', 'Assemble bowl with all toppings.', 'Drizzle with tahini.'],
    tip: 'Roast the chickpeas for extra crunch.',
    source: 'builtin',
  },
  {
    cat: 'lunch', type: 'Lunch', color: 'var(--teal)', sc: 'tl',
    name: 'Chicken Caesar Wrap', tag: 'High protein · meal prep',
    prepL: '15 min', prepC: 'var(--teal)', prepTime: '15 min', healthTag: 'healthy',
    hk: 520, hp: '38', hc: '44', hf: '18',
    mk: 440, mp: '32', mc: '38', mf: '14',
    ings: [['Grilled chicken breast', '150g'], ['Wholemeal wrap', '1 large'], ['Romaine lettuce', '50g'], ['Caesar dressing', '1 tbsp'], ['Parmesan', '10g']],
    steps: ['Slice chicken.', 'Layer lettuce and chicken on wrap.', 'Drizzle dressing and add parmesan.', 'Roll tightly.'],
    tip: 'Grill extra chicken at the start of the week for quick lunches.',
    source: 'builtin',
  },
  {
    cat: 'lunch', type: 'Lunch', color: 'var(--teal)', sc: 'tl',
    name: 'Red Lentil Soup', tag: 'Vegan · fibre-rich',
    prepL: '30 min', prepC: 'var(--teal)', prepTime: '30 min', healthTag: 'healthy',
    hk: 360, hp: '20', hc: '56', hf: '4',
    mk: 300, mp: '17', mc: '46', mf: '3',
    ings: [['Red lentils', '150g'], ['Onion', '1 medium'], ['Cumin', '1 tsp'], ['Turmeric', '½ tsp'], ['Vegetable stock', '800ml']],
    steps: ['Sauté onion until soft.', 'Add spices and cook 1 min.', 'Add lentils and stock, simmer 20 min.', 'Blend until smooth.'],
    tip: 'A squeeze of lemon at the end brightens the flavour.',
    source: 'builtin',
  },
  // ── Dinner ─────────────────────────────────────────────────────────────────
  {
    cat: 'dinner', type: 'Dinner', color: 'var(--coral)', sc: 'co',
    name: 'Baked Salmon & Veg', tag: 'Omega-3 · 30 min',
    prepL: '30 min', prepC: 'var(--coral)', prepTime: '30 min', healthTag: 'healthy',
    hk: 520, hp: '42', hc: '28', hf: '26',
    mk: 430, mp: '36', mc: '22', mf: '20',
    ings: [['Salmon fillet', '180g'], ['Broccoli', '150g'], ['Cherry tomatoes', '100g'], ['Olive oil', '1 tbsp'], ['Lemon', '½']],
    steps: ['Preheat oven to 200 °C.', 'Place salmon and veg on a tray.', 'Drizzle with oil and lemon.', 'Bake 20 min.'],
    tip: 'Salmon is done when it flakes easily with a fork.',
    source: 'builtin',
  },
  {
    cat: 'dinner', type: 'Dinner', color: 'var(--coral)', sc: 'co',
    name: 'Tofu Stir-Fry', tag: 'Vegan · quick',
    prepL: '20 min', prepC: 'var(--coral)', prepTime: '20 min', healthTag: 'healthy',
    hk: 420, hp: '22', hc: '46', hf: '16',
    mk: 350, mp: '18', mc: '38', mf: '12',
    ings: [['Firm tofu', '200g'], ['Mixed stir-fry veg', '200g'], ['Soy sauce', '2 tbsp'], ['Sesame oil', '1 tsp'], ['Brown rice', '80g dry']],
    steps: ['Press tofu dry and cube it.', 'Fry tofu until golden.', 'Add veg and soy sauce.', 'Serve over rice.'],
    tip: 'Pressing the tofu for 15 min before cooking improves texture.',
    source: 'builtin',
  },
  {
    cat: 'dinner', type: 'Dinner', color: 'var(--coral)', sc: 'co',
    name: 'Chicken & Sweet Potato', tag: 'Meal prep · high protein',
    prepL: '40 min', prepC: 'var(--coral)', prepTime: '40 min', healthTag: 'healthy',
    hk: 560, hp: '44', hc: '54', hf: '12',
    mk: 470, mp: '38', mc: '46', mf: '10',
    ings: [['Chicken thighs', '200g'], ['Sweet potato', '200g'], ['Garlic', '2 cloves'], ['Paprika', '1 tsp'], ['Olive oil', '1 tbsp']],
    steps: ['Cut sweet potato into cubes.', 'Season chicken with paprika and garlic.', 'Roast everything at 200 °C for 35 min.'],
    tip: 'Bone-in thighs stay juicier than breast during roasting.',
    source: 'builtin',
  },
  // ── Dessert ────────────────────────────────────────────────────────────────
  {
    cat: 'dessert', type: 'Dessert', color: 'var(--purple)', sc: 'pu',
    name: 'Chia Seed Pudding', tag: 'No cook · make ahead',
    prepL: '5 min + set', prepC: 'var(--purple)', prepTime: '5 min', healthTag: 'healthy',
    hk: 240, hp: '8', hc: '28', hf: '10', hfi: '9',
    mk: 200, mp: '6', mc: '22', mf: '8',
    ings: [['Chia seeds', '40g'], ['Coconut milk', '200ml'], ['Vanilla extract', '½ tsp'], ['Maple syrup', '1 tsp']],
    steps: ['Mix chia seeds and coconut milk.', 'Stir in vanilla and maple syrup.', 'Refrigerate at least 2 hours until set.'],
    tip: 'Stir after 10 min to prevent clumping.',
    source: 'builtin',
  },
  {
    cat: 'dessert', type: 'Dessert', color: 'var(--purple)', sc: 'pu',
    name: 'Dark Chocolate Energy Balls', tag: 'No bake · 15 min',
    prepL: '15 min', prepC: 'var(--purple)', prepTime: '15 min', healthTag: 'indulgent',
    hk: 180, hp: '5', hc: '22', hf: '9',
    mk: 150, mp: '4', mc: '18', mf: '7',
    ings: [['Medjool dates', '6'], ['Rolled oats', '60g'], ['Cocoa powder', '2 tbsp'], ['Almond butter', '2 tbsp']],
    steps: ['Blend dates until paste.', 'Mix with remaining ingredients.', 'Roll into 12 balls and refrigerate.'],
    tip: 'Coat in shredded coconut for an elegant finish.',
    source: 'builtin',
  },
  // ── Snacks ─────────────────────────────────────────────────────────────────
  {
    cat: 'snack', type: 'Snack', color: 'var(--amber)', sc: 'am',
    name: 'Hummus & Veggie Sticks', tag: 'High fibre · light',
    prepL: '5 min', prepC: 'var(--amber)', prepTime: '5 min', healthTag: 'healthy',
    hk: 200, hp: '8', hc: '22', hf: '9',
    mk: 160, mp: '6', mc: '18', mf: '7',
    ings: [['Hummus', '80g'], ['Carrot sticks', '60g'], ['Celery sticks', '60g'], ['Cucumber sticks', '60g']],
    steps: ['Portion hummus into a bowl.', 'Arrange veggie sticks alongside.'],
    tip: 'Make your own hummus — it only takes 5 minutes in a blender.',
    source: 'builtin',
  },
  {
    cat: 'snack', type: 'Snack', color: 'var(--amber)', sc: 'am',
    name: 'Apple & Almond Butter', tag: 'Simple · energising',
    prepL: '2 min', prepC: 'var(--amber)', prepTime: '2 min', healthTag: 'healthy',
    hk: 240, hp: '6', hc: '30', hf: '12',
    mk: 200, mp: '5', mc: '25', mf: '10',
    ings: [['Apple', '1 medium'], ['Almond butter', '2 tbsp']],
    steps: ['Core and slice apple.', 'Serve with almond butter for dipping.'],
    tip: 'A pinch of cinnamon on the almond butter adds flavour.',
    source: 'builtin',
  },
  // ── Drinks ─────────────────────────────────────────────────────────────────
  {
    cat: 'drinks', type: 'Drink', color: 'var(--teal)', sc: 'tl',
    name: 'Golden Milk Latte', tag: 'Anti-inflammatory · soothing',
    prepL: '5 min', prepC: 'var(--teal)', prepTime: '5 min', healthTag: 'healthy',
    hk: 120, hp: '4', hc: '12', hf: '6',
    mk: 90, mp: '3', mc: '9', mf: '4',
    ings: [['Oat milk', '250ml'], ['Turmeric', '½ tsp'], ['Cinnamon', '¼ tsp'], ['Ginger powder', '¼ tsp'], ['Honey', '1 tsp']],
    steps: ['Heat milk in a small saucepan.', 'Whisk in spices and honey.', 'Pour into a mug.'],
    tip: 'Add a grind of black pepper to increase turmeric absorption.',
    source: 'builtin',
  },
  {
    cat: 'drinks', type: 'Drink', color: 'var(--teal)', sc: 'tl',
    name: 'Matcha Latte', tag: 'Focused energy · antioxidants',
    prepL: '5 min', prepC: 'var(--teal)', prepTime: '5 min', healthTag: 'healthy',
    hk: 100, hp: '3', hc: '10', hf: '5',
    mk: 80, mp: '2', mc: '8', mf: '4',
    ings: [['Ceremonial matcha', '1 tsp'], ['Hot water (70 °C)', '50ml'], ['Oat milk', '200ml'], ['Honey', 'to taste']],
    steps: ['Sift matcha into a bowl.', 'Whisk with hot water until frothy.', 'Steam milk and pour over matcha.'],
    tip: 'Use 70 °C water — boiling water makes matcha bitter.',
    source: 'builtin',
  },
]
