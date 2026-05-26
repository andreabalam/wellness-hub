export interface GroceryItem {
  n: string
  t?: 'add' | 'swap' | 'remove'
}

export const GROCERY_DATA: Record<string, GroceryItem[]> = {
  'Produce - Vegetables': [
    { n: 'Baby spinach' }, { n: 'Cherry tomatoes' }, { n: 'Cucumber' }, { n: 'Bell peppers' },
    { n: 'Broccoli' }, { n: 'Avocados' }, { n: 'Garlic' }, { n: 'Yellow onion' }, { n: 'Red onion' },
    { n: 'Lettuce' }, { n: 'Potatoes' },
    { n: 'Arugula or mixed greens', t: 'add' }, { n: 'Cauliflower rice frozen', t: 'add' }, { n: 'Frozen edamame', t: 'add' },
  ],
  'Produce - Fruit': [
    { n: 'Blueberries' }, { n: 'Strawberries' }, { n: 'Bananas' }, { n: 'Lemons' }, { n: 'Limes' },
    { n: 'Apples' }, { n: 'Oranges' }, { n: 'Dates' }, { n: 'Raisins' },
  ],
  'Protein - Animal': [
    { n: 'Eggs, large 18-count' }, { n: 'Chicken breasts' }, { n: 'Chicken thighs' },
    { n: 'Salmon fillets' }, { n: 'Chicken sausages' },
    { n: 'Canned tuna in water', t: 'add' }, { n: 'Canned sardines or mackerel', t: 'add' },
  ],
  'Protein - Plant': [
    { n: 'Canned chickpeas' }, { n: 'Canned black beans' },
    { n: 'Canned or dry green lentils', t: 'add' },
  ],
  'Dairy and Refrigerated': [
    { n: 'Greek yogurt plain 0%' }, { n: 'Feta cheese' }, { n: 'Almond milk unsweetened' },
    { n: 'Fat-free milk' }, { n: 'Light sour cream' },
    { n: 'Cream cheese - buy Neufchatel reduced-fat', t: 'swap' },
    { n: 'Cheddar small amount only', t: 'swap' },
    { n: 'Heavy cream', t: 'remove' },
    { n: 'Kefir plain low-fat', t: 'add' }, { n: 'Cottage cheese low-fat', t: 'add' },
  ],
  'Grains and Bread': [
    { n: 'Rolled oats or steel-cut oats' }, { n: 'Whole wheat rice' },
    { n: 'Low-carb flour tortillas - check for seed oils', t: 'swap' },
    { n: 'Pasta - swap for chickpea or lentil pasta Banza', t: 'swap' },
    { n: 'Whole wheat flour' }, { n: 'Bread flour' }, { n: 'All-purpose flour' }, { n: 'Cornstarch' },
  ],
  'Nuts, Seeds and Fat': [
    { n: 'Walnuts' }, { n: 'Chia seeds' }, { n: 'Pistachios' }, { n: 'Macadamia nuts' },
    { n: 'White sesame seeds' }, { n: 'PB2 powdered peanut butter' },
    { n: 'Tahini', t: 'add' },
  ],
  'Oils and Condiments': [
    { n: 'Olive oil extra virgin' }, { n: 'Avocado oil' }, { n: 'Sesame oil' },
    { n: 'Low-sodium soy sauce or tamari' }, { n: 'Dijon mustard' }, { n: 'Yellow mustard' },
    { n: 'Apple cider vinegar' }, { n: 'Rice vinegar' }, { n: 'Red wine vinegar' },
    { n: 'Honey' }, { n: 'Maple syrup' }, { n: 'Capers' }, { n: 'Kalamata olives' },
    { n: 'Sambal' }, { n: 'Jamaica dried hibiscus - already in pantry' },
    { n: "Pasta sauce 0g added sugar e.g. Rao's", t: 'swap' },
    { n: 'Mayo - avocado oil mayo Primal Kitchen', t: 'swap' },
    { n: 'Cajeta', t: 'remove' }, { n: 'Lard', t: 'remove' },
  ],
  'Spices and Seasonings': [
    { n: 'Pink salt' }, { n: 'Flaky salt' }, { n: 'Black pepper' }, { n: 'Everyday seasoning' },
    { n: 'Cinnamon' }, { n: 'Nutmeg' }, { n: 'Ginger powder' }, { n: 'Star anise' },
    { n: 'Vanilla extract' }, { n: 'Madagascar vanilla paste' },
    { n: 'Cumin' }, { n: 'Turmeric' }, { n: 'Smoked paprika' }, { n: 'Oregano dry' },
    { n: 'Thyme dry' }, { n: 'Rosemary dry' }, { n: 'Basil dry' }, { n: 'Dill dry' },
    { n: 'Red pepper flakes' }, { n: 'Guajillo chile powder' }, { n: 'Chipotle chili powder' },
    { n: 'Cayenne' }, { n: 'Onion powder' }, { n: 'Garlic powder' }, { n: 'Old Bay' },
    { n: 'Everything Bagel seasoning' }, { n: 'Sandwich sprinkle' },
    { n: 'Zaatar' }, { n: 'Herbs de Provence' }, { n: 'Curry powder' },
    { n: 'Ground cloves' }, { n: 'Bay leaves' },
  ],
  'Baking': [
    { n: 'Baking powder' }, { n: 'Baking soda' }, { n: 'Cocoa powder unsweetened' },
    { n: 'Dark chocolate 70% bar small' },
    { n: 'Chocolate chips', t: 'remove' },
    { n: 'Powdered sugar', t: 'remove' },
    { n: 'White sugar - small jar only', t: 'swap' },
  ],
  'Supplements and Extras': [
    { n: 'Fish oil omega-3' }, { n: 'Creatine' }, { n: 'Whey protein vanilla' },
    { n: 'Fresh parsley' }, { n: 'Matcha unsweetened' },
    { n: 'Nutritional yeast', t: 'add' },
    { n: 'Curtido - make at home', t: 'add' },
    { n: 'Fermented agua de jamaica - make at home', t: 'add' },
    { n: 'Kind bars', t: 'remove' },
  ],
}
