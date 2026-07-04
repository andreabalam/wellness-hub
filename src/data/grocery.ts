export interface NutriInfo {
  srv: string // serving size label, e.g. "1 cup"
  cal: number // calories
  p: number // protein g
  c: number // carbs g
  f: number // fat g
  fi?: number // fiber g
}

export interface GroceryItem {
  n: string
  t?: 'add' | 'swap' | 'remove'
  nutri?: NutriInfo
}

/**
 * A user-owned grocery catalog item.
 * id is a client-side uuid; nutri is optional.
 */
export interface GroceryCatalogItem {
  id: string
  n: string
  cat: string
  nutri?: NutriInfo
}

/** All 11 grocery categories — used in dropdowns and category headers. */
export const GROCERY_CATEGORIES = [
  'Produce - Vegetables',
  'Produce - Fruit',
  'Protein - Animal',
  'Protein - Plant',
  'Dairy and Refrigerated',
  'Grains and Bread',
  'Nuts, Seeds and Fat',
  'Oils and Condiments',
  'Spices and Seasonings',
  'Baking',
  'Supplements and Extras',
] as const

export type GroceryCategory = (typeof GROCERY_CATEGORIES)[number]

export const GROCERY_DATA: Record<string, GroceryItem[]> = {
  'Produce - Vegetables': [
    { n: 'Baby spinach', nutri: { srv: '1 cup raw', cal: 7, p: 0.9, c: 1.1, f: 0.1, fi: 0.7 } },
    { n: 'Cherry tomatoes', nutri: { srv: '1 cup', cal: 27, p: 1.3, c: 5.8, f: 0.3, fi: 1.8 } },
    { n: 'Cucumber', nutri: { srv: '1 cup sliced', cal: 16, p: 0.7, c: 3.8, f: 0.1, fi: 0.5 } },
    { n: 'Bell peppers', nutri: { srv: '1 medium', cal: 31, p: 1.0, c: 7.2, f: 0.3, fi: 2.5 } },
    { n: 'Broccoli', nutri: { srv: '1 cup chopped', cal: 31, p: 2.5, c: 6.0, f: 0.3, fi: 2.4 } },
    { n: 'Avocados', nutri: { srv: '½ avocado', cal: 120, p: 1.5, c: 6.4, f: 11, fi: 5.0 } },
    { n: 'Garlic', nutri: { srv: '1 clove', cal: 4, p: 0.2, c: 1.0, f: 0.0 } },
    { n: 'Yellow onion', nutri: { srv: '½ medium', cal: 22, p: 0.6, c: 5.2, f: 0.1, fi: 0.9 } },
    { n: 'Red onion', nutri: { srv: '½ medium', cal: 22, p: 0.6, c: 5.2, f: 0.1, fi: 0.9 } },
    { n: 'Lettuce', nutri: { srv: '1 cup shredded', cal: 5, p: 0.5, c: 1.0, f: 0.1, fi: 0.5 } },
    { n: 'Potatoes', nutri: { srv: '1 medium', cal: 161, p: 4.3, c: 37, f: 0.2, fi: 3.8 } },
    {
      n: 'Arugula or mixed greens',
      t: 'add',
      nutri: { srv: '1 cup', cal: 5, p: 0.5, c: 0.7, f: 0.1, fi: 0.3 },
    },
    {
      n: 'Cauliflower rice frozen',
      t: 'add',
      nutri: { srv: '1 cup', cal: 25, p: 2.0, c: 5.0, f: 0.3, fi: 2.0 },
    },
    {
      n: 'Frozen edamame',
      t: 'add',
      nutri: { srv: '½ cup shelled', cal: 94, p: 8.4, c: 7.4, f: 4.0, fi: 3.8 },
    },
  ],
  'Produce - Fruit': [
    { n: 'Blueberries', nutri: { srv: '1 cup', cal: 84, p: 1.1, c: 21, f: 0.5, fi: 3.6 } },
    { n: 'Strawberries', nutri: { srv: '1 cup', cal: 49, p: 1.0, c: 12, f: 0.5, fi: 3.0 } },
    { n: 'Bananas', nutri: { srv: '1 medium', cal: 105, p: 1.3, c: 27, f: 0.4, fi: 3.1 } },
    { n: 'Lemons', nutri: { srv: '1 medium', cal: 17, p: 0.6, c: 5.4, f: 0.2, fi: 1.6 } },
    { n: 'Limes', nutri: { srv: '1 medium', cal: 20, p: 0.5, c: 7.1, f: 0.1, fi: 1.9 } },
    { n: 'Apples', nutri: { srv: '1 medium', cal: 95, p: 0.5, c: 25, f: 0.3, fi: 4.4 } },
    { n: 'Oranges', nutri: { srv: '1 medium', cal: 62, p: 1.2, c: 15, f: 0.2, fi: 3.1 } },
    { n: 'Dates', nutri: { srv: '2 dates', cal: 110, p: 0.8, c: 30, f: 0.1, fi: 2.8 } },
    { n: 'Raisins', nutri: { srv: '¼ cup', cal: 124, p: 1.3, c: 33, f: 0.2, fi: 1.6 } },
  ],
  'Protein - Animal': [
    { n: 'Eggs, large 18-count', nutri: { srv: '1 large egg', cal: 72, p: 6.3, c: 0.4, f: 4.8 } },
    { n: 'Chicken breasts', nutri: { srv: '4 oz cooked', cal: 130, p: 26, c: 0.0, f: 2.9 } },
    { n: 'Chicken thighs', nutri: { srv: '4 oz cooked', cal: 178, p: 24, c: 0.0, f: 8.5 } },
    { n: 'Salmon fillets', nutri: { srv: '4 oz cooked', cal: 207, p: 28, c: 0.0, f: 10 } },
    { n: 'Chicken sausages', nutri: { srv: '1 link (85g)', cal: 140, p: 14, c: 4.0, f: 7.0 } },
    {
      n: 'Canned tuna in water',
      t: 'add',
      nutri: { srv: '3 oz drained', cal: 109, p: 24, c: 0.0, f: 2.5 },
    },
    {
      n: 'Canned sardines or mackerel',
      t: 'add',
      nutri: { srv: '3 oz', cal: 177, p: 20, c: 0.0, f: 10 },
    },
  ],
  'Protein - Plant': [
    { n: 'Canned chickpeas', nutri: { srv: '½ cup', cal: 134, p: 7.3, c: 22, f: 2.1, fi: 6.2 } },
    { n: 'Canned black beans', nutri: { srv: '½ cup', cal: 114, p: 7.6, c: 20, f: 0.5, fi: 7.5 } },
    {
      n: 'Canned or dry green lentils',
      t: 'add',
      nutri: { srv: '½ cup cooked', cal: 115, p: 9.0, c: 20, f: 0.4, fi: 7.8 },
    },
  ],
  'Dairy and Refrigerated': [
    { n: 'Greek yogurt plain 0%', nutri: { srv: '6 oz', cal: 100, p: 17, c: 6.0, f: 0.7 } },
    { n: 'Feta cheese', nutri: { srv: '1 oz', cal: 75, p: 4.0, c: 1.2, f: 6.0 } },
    { n: 'Almond milk unsweetened', nutri: { srv: '1 cup', cal: 30, p: 1.0, c: 1.0, f: 2.5 } },
    { n: 'Fat-free milk', nutri: { srv: '1 cup', cal: 83, p: 8.3, c: 12, f: 0.2 } },
    { n: 'Light sour cream', nutri: { srv: '2 tbsp', cal: 40, p: 1.0, c: 2.0, f: 2.5 } },
    {
      n: 'Cream cheese - buy Neufchatel reduced-fat',
      t: 'swap',
      nutri: { srv: '1 oz', cal: 70, p: 3.0, c: 1.0, f: 6.5 },
    },
    {
      n: 'Cheddar small amount only',
      t: 'swap',
      nutri: { srv: '1 oz', cal: 113, p: 7.0, c: 0.4, f: 9.3 },
    },
    { n: 'Heavy cream', t: 'remove' },
    { n: 'Kefir plain low-fat', t: 'add', nutri: { srv: '1 cup', cal: 110, p: 11, c: 12, f: 2.0 } },
    {
      n: 'Cottage cheese low-fat',
      t: 'add',
      nutri: { srv: '½ cup', cal: 90, p: 12, c: 5.0, f: 2.5 },
    },
  ],
  'Grains and Bread': [
    {
      n: 'Rolled oats or steel-cut oats',
      nutri: { srv: '½ cup dry', cal: 150, p: 5.0, c: 27, f: 2.5, fi: 4.0 },
    },
    {
      n: 'Whole wheat rice',
      nutri: { srv: '¼ cup dry', cal: 160, p: 3.5, c: 35, f: 1.5, fi: 2.0 },
    },
    {
      n: 'Low-carb flour tortillas - check for seed oils',
      t: 'swap',
      nutri: { srv: '1 tortilla', cal: 70, p: 5.0, c: 11, f: 3.0, fi: 8.0 },
    },
    {
      n: 'Pasta - swap for chickpea or lentil pasta Banza',
      t: 'swap',
      nutri: { srv: '2 oz dry', cal: 190, p: 13, c: 32, f: 3.0, fi: 8.0 },
    },
    { n: 'Whole wheat flour', nutri: { srv: '¼ cup', cal: 100, p: 4.0, c: 22, f: 0.5, fi: 3.0 } },
    { n: 'Bread flour', nutri: { srv: '¼ cup', cal: 110, p: 4.0, c: 23, f: 0.5 } },
    { n: 'All-purpose flour', nutri: { srv: '¼ cup', cal: 110, p: 3.0, c: 23, f: 0.3 } },
    { n: 'Cornstarch', nutri: { srv: '1 tbsp', cal: 30, p: 0.0, c: 7.3, f: 0.0 } },
  ],
  'Nuts, Seeds and Fat': [
    { n: 'Walnuts', nutri: { srv: '1 oz (14 halves)', cal: 185, p: 4.3, c: 3.9, f: 18, fi: 1.9 } },
    { n: 'Chia seeds', nutri: { srv: '2 tbsp', cal: 98, p: 3.3, c: 8.5, f: 6.3, fi: 7.7 } },
    {
      n: 'Pistachios',
      nutri: { srv: '1 oz (~49 nuts)', cal: 160, p: 6.0, c: 8.0, f: 13, fi: 3.0 },
    },
    {
      n: 'Macadamia nuts',
      nutri: { srv: '1 oz (10-12 nuts)', cal: 204, p: 2.2, c: 3.9, f: 21, fi: 2.4 },
    },
    { n: 'White sesame seeds', nutri: { srv: '1 tbsp', cal: 52, p: 1.6, c: 2.1, f: 4.5, fi: 1.1 } },
    {
      n: 'PB2 powdered peanut butter',
      nutri: { srv: '2 tbsp', cal: 45, p: 5.0, c: 4.0, f: 1.5, fi: 1.0 },
    },
    { n: 'Tahini', t: 'add', nutri: { srv: '1 tbsp', cal: 89, p: 2.6, c: 3.2, f: 8.0, fi: 0.7 } },
  ],
  'Oils and Condiments': [
    { n: 'Olive oil extra virgin', nutri: { srv: '1 tbsp', cal: 119, p: 0.0, c: 0.0, f: 14 } },
    { n: 'Avocado oil', nutri: { srv: '1 tbsp', cal: 124, p: 0.0, c: 0.0, f: 14 } },
    { n: 'Sesame oil', nutri: { srv: '1 tbsp', cal: 120, p: 0.0, c: 0.0, f: 14 } },
    {
      n: 'Low-sodium soy sauce or tamari',
      nutri: { srv: '1 tbsp', cal: 10, p: 1.0, c: 1.0, f: 0.0 },
    },
    { n: 'Dijon mustard', nutri: { srv: '1 tsp', cal: 5, p: 0.3, c: 0.3, f: 0.3 } },
    { n: 'Yellow mustard', nutri: { srv: '1 tsp', cal: 3, p: 0.2, c: 0.3, f: 0.2 } },
    { n: 'Apple cider vinegar' },
    { n: 'Rice vinegar' },
    { n: 'Red wine vinegar' },
    { n: 'Honey', nutri: { srv: '1 tbsp', cal: 64, p: 0.1, c: 17, f: 0.0 } },
    { n: 'Maple syrup', nutri: { srv: '1 tbsp', cal: 52, p: 0.0, c: 13, f: 0.1 } },
    { n: 'Capers' },
    { n: 'Kalamata olives', nutri: { srv: '5 olives', cal: 35, p: 0.3, c: 2.0, f: 3.5 } },
    { n: 'Sambal' },
    { n: 'Jamaica dried hibiscus - already in pantry' },
    {
      n: "Pasta sauce 0g added sugar e.g. Rao's",
      t: 'swap',
      nutri: { srv: '½ cup', cal: 80, p: 2.0, c: 9.0, f: 5.0, fi: 2.0 },
    },
    {
      n: 'Mayo - avocado oil mayo Primal Kitchen',
      t: 'swap',
      nutri: { srv: '1 tbsp', cal: 90, p: 0.0, c: 0.0, f: 10 },
    },
    { n: 'Cajeta', t: 'remove' },
    { n: 'Lard', t: 'remove' },
  ],
  'Spices and Seasonings': [
    { n: 'Pink salt' },
    { n: 'Flaky salt' },
    { n: 'Black pepper' },
    { n: 'Everyday seasoning' },
    { n: 'Cinnamon' },
    { n: 'Nutmeg' },
    { n: 'Ginger powder' },
    { n: 'Star anise' },
    { n: 'Vanilla extract' },
    { n: 'Madagascar vanilla paste' },
    { n: 'Cumin' },
    { n: 'Turmeric' },
    { n: 'Smoked paprika' },
    { n: 'Oregano dry' },
    { n: 'Thyme dry' },
    { n: 'Rosemary dry' },
    { n: 'Basil dry' },
    { n: 'Dill dry' },
    { n: 'Red pepper flakes' },
    { n: 'Guajillo chile powder' },
    { n: 'Chipotle chili powder' },
    { n: 'Cayenne' },
    { n: 'Onion powder' },
    { n: 'Garlic powder' },
    { n: 'Old Bay' },
    { n: 'Everything Bagel seasoning' },
    { n: 'Sandwich sprinkle' },
    { n: 'Zaatar' },
    { n: 'Herbs de Provence' },
    { n: 'Curry powder' },
    { n: 'Ground cloves' },
    { n: 'Bay leaves' },
  ],
  Baking: [
    { n: 'Baking powder' },
    { n: 'Baking soda' },
    {
      n: 'Cocoa powder unsweetened',
      nutri: { srv: '1 tbsp', cal: 12, p: 1.0, c: 3.0, f: 0.7, fi: 1.8 },
    },
    {
      n: 'Dark chocolate 70% bar small',
      nutri: { srv: '1 oz', cal: 170, p: 2.0, c: 13, f: 12, fi: 3.0 },
    },
    { n: 'Chocolate chips', t: 'remove' },
    { n: 'Powdered sugar', t: 'remove' },
    {
      n: 'White sugar - small jar only',
      t: 'swap',
      nutri: { srv: '1 tsp', cal: 16, p: 0.0, c: 4.2, f: 0.0 },
    },
  ],
  'Supplements and Extras': [
    { n: 'Fish oil omega-3' },
    { n: 'Creatine', nutri: { srv: '5g (1 tsp)', cal: 0, p: 0.0, c: 0.0, f: 0.0 } },
    { n: 'Whey protein vanilla', nutri: { srv: '1 scoop', cal: 120, p: 25, c: 3.0, f: 1.5 } },
    { n: 'Fresh parsley' },
    { n: 'Matcha unsweetened', nutri: { srv: '1 tsp', cal: 5, p: 0.5, c: 1.0, f: 0.0 } },
    {
      n: 'Nutritional yeast',
      t: 'add',
      nutri: { srv: '2 tbsp', cal: 40, p: 8.0, c: 3.0, f: 0.5, fi: 2.0 },
    },
    { n: 'Curtido - make at home', t: 'add' },
    { n: 'Fermented agua de jamaica - make at home', t: 'add' },
    { n: 'Kind bars', t: 'remove' },
  ],
}
