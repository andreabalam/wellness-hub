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
}

export const PRESET_CATS = ['breakfast', 'smoothie', 'lunch', 'dinner', 'dessert', 'ferments', 'snack', 'sauce', 'drink', 'side']

export const ALL_RECIPES: Recipe[] = [
  {
    cat: 'breakfast', type: 'Breakfast', color: 'var(--amber)', sc: 'ca', name: 'Berry Walnut Power Oats',
    tag: 'Prep night before - 5 min', prepL: 'Prep ahead', prepC: 'var(--teal)', hk: 350, hp: '18g', hc: '42g', hf: '12g', mk: 420, mp: '22g', mc: '50g', mf: '14g',
    ings: [['Rolled oats', '35g / 45g'], ['Greek yogurt 0%', '75g / 100g'], ['Almond milk', '110ml / 140ml'], ['Chia seeds', '1 tbsp each'], ['Mixed frozen berries', '75g each'], ['Walnuts, chopped', '12g / 18g'], ['Cinnamon', '1/2 tsp'], ['Vanilla extract', '1/4 tsp']],
    steps: ['Combine oats, chia, almond milk, cinnamon, vanilla in jar. Stir well.', 'Spoon Greek yogurt on top - do not stir. Seal and refrigerate overnight.', 'Morning: top with berries (straight from frozen) and walnuts.'],
    tip: 'Make Mon-Wed jars on Sunday night. Three days of breakfasts in 12 minutes.',
  },
  {
    cat: 'breakfast', type: 'Breakfast', color: 'var(--amber)', sc: 'ca', name: 'Chipotle Egg and Black Bean Scramble',
    tag: '12 min - high protein', prepL: 'Quick', prepC: 'var(--green)', hk: 340, hp: '30g', hc: '18g', hf: '16g', mk: 430, mp: '38g', mc: '22g', mf: '19g',
    ings: [['Whole eggs', '2 each'], ['Egg whites', '2 (her) / 4 (him)'], ['Canned black beans, rinsed', '1/4 cup / 1/3 cup'], ['Baby spinach', '1 cup each'], ['Cherry tomatoes, halved', '1/2 cup each'], ['Chipotle chili powder', '1/4 tsp each'], ['Cumin', '1/4 tsp'], ['Avocado oil', '1 tsp each'], ['Feta crumbles', '1 tbsp each']],
    steps: ['Heat oil. Add tomatoes and beans with cumin. Cook 2 min.', 'Add spinach, wilt. Whisk eggs + whites with chipotle. Pour in and scramble low and slow.', 'Top with feta. Serve with 1/2 low-carb tortilla if desired.'],
    tip: 'Chipotle + cumin is the pairing that makes this feel like restaurant-level breakfast.',
  },
  {
    cat: 'breakfast', type: 'Breakfast', color: 'var(--amber)', sc: 'ca', name: 'Matcha Overnight Oats',
    tag: 'Prep night before - 5 min', prepL: 'Prep ahead', prepC: 'var(--teal)', hk: 355, hp: '20g', hc: '44g', hf: '11g', mk: 435, mp: '25g', mc: '53g', mf: '13g',
    ings: [['Rolled oats', '35g / 45g'], ['Greek yogurt 0%', '75g / 100g'], ['Almond milk', '110ml / 140ml'], ['Chia seeds', '1 tbsp each'], ['Matcha powder', '1 tsp each'], ['Honey', '1/2 tsp each'], ['Vanilla extract', '1/4 tsp'], ['Strawberries, sliced', '80g each'], ['Pistachios, chopped', '10g / 15g']],
    steps: ['Whisk matcha with 2 tbsp warm water until smooth - no clumps.', 'Combine oats, chia, almond milk, vanilla, and matcha in jar. Stir well.', 'Add yogurt on top. Seal and refrigerate overnight.', 'Morning: top with strawberries and pistachios.'],
    tip: 'Matcha provides caffeine + L-theanine - calmer sustained alertness without the cortisol spike.',
  },
  {
    cat: 'breakfast', type: 'Breakfast', color: 'var(--amber)', sc: 'ca', name: 'Greek Yogurt Power Bowl',
    tag: '5 min - no cook', prepL: 'Quick', prepC: 'var(--green)', hk: 320, hp: '28g', hc: '32g', hf: '8g', mk: 400, mp: '34g', mc: '40g', mf: '10g',
    ings: [['Greek yogurt 0%', '200g / 250g'], ['Blueberries or strawberries', '80g each'], ['Banana, sliced', '1/4 / 1/2'], ['Walnuts, chopped', '10g / 15g'], ['Chia seeds', '1 tsp each'], ['PB2 powder', '1 tbsp each'], ['Cinnamon', 'pinch'], ['Honey optional', '1/2 tsp / 1 tsp']],
    steps: ['Spoon Greek yogurt into a bowl.', 'Layer fruit on top. Sprinkle PB2 and chia seeds.', 'Add walnuts and cinnamon. Drizzle honey if using.'],
    tip: 'PB2 adds peanut butter flavor and protein at a fraction of the calories. Three minutes, done.',
  },
  {
    cat: 'smoothie', type: 'Smoothie', color: 'var(--blue)', sc: 'cb', name: 'Green Protein Powerhouse',
    tag: '5 min - blender', prepL: 'Quick', prepC: 'var(--green)', hk: 390, hp: '35g', hc: '56g', hf: '9g', mk: 480, mp: '43g', mc: '66g', mf: '10g',
    ings: [['Baby spinach', '1 large handful each'], ['Frozen banana', '1/2 / 1'], ['Frozen blueberries', '1/2 cup each'], ['Almond milk', '240ml / 300ml'], ['Whey protein vanilla', '1 scoop each'], ['Chia seeds', '1 tbsp each'], ['Rolled oats', '1/4 cup each'], ['Creatine monohydrate', '3-5g (1 tsp) each'], ['Medjool dates, pitted', '1-2 each (soaked 10 min in warm water)'], ['Ginger powder', '1/4 tsp'], ['Cinnamon', '1/4 tsp'], ['Ice cubes', '4-5 each']],
    steps: ['Soak dates in warm water 10 min, drain. This is key - dry dates will leave chunks no matter how long you blend.', 'Blend oats, almond milk, and soaked dates first for 30 seconds until completely smooth.', 'Add remaining ingredients including creatine. Blend on high 45-60 seconds until completely smooth.', 'Drink immediately or refrigerate up to 8 hrs (chia thickens it as it sits).'],
    tip: '1 Medjool date adds ~66 kcal and a natural caramel sweetness that deepens the blueberry flavor considerably. Dates also bring potassium, magnesium, and fiber alongside the sweetness - a meaningful upgrade over honey. The soaking step is non-negotiable for silky texture. Use 1 date for subtle sweetness, 2 if you prefer it more pronounced. Creatine is flavorless and completely undetectable.',
  },
  {
    cat: 'smoothie', type: 'Smoothie', color: 'var(--blue)', sc: 'cb', name: 'Tropical Turmeric Recovery',
    tag: '5 min - anti-inflammatory - post-workout', prepL: 'Quick', prepC: 'var(--green)', hk: 415, hp: '31g', hc: '58g', hf: '7g', mk: 510, mp: '39g', mc: '70g', mf: '8g',
    ings: [['Frozen mango or pineapple', '1/2 cup each'], ['Frozen banana', '1/2 each'], ['Fat-free milk or almond milk', '240ml / 300ml'], ['Whey protein vanilla', '1 scoop each'], ['Chia seeds', '1 tbsp each'], ['Creatine monohydrate', '3-5g (1 tsp) each'], ['Medjool dates, pitted', '1 each (soaked 10 min in warm water)'], ['Turmeric', '1/2 tsp'], ['Ginger powder', '1/4 tsp'], ['Black pepper', 'tiny pinch - activates turmeric absorption'], ['Ice', '4 cubes']],
    steps: ['Soak date in warm water 10 min, drain.', 'Combine all ingredients including creatine and date in blender.', 'Blend 45 seconds until smooth and creamy.', 'Black pepper is non-negotiable - it increases curcumin bioavailability by 2,000%.'],
    tip: 'Dates replace honey here entirely - they add the same sweetness with fiber and minerals instead of raw sugar. Best smoothie for post-workout creatine timing.',
  },
  {
    cat: 'smoothie', type: 'Smoothie', color: 'var(--blue)', sc: 'cb', name: 'Strawberry Matcha Energizer',
    tag: '5 min - caffeine + L-theanine', prepL: 'Quick', prepC: 'var(--green)', hk: 395, hp: '29g', hc: '60g', hf: '6g', mk: 490, mp: '36g', mc: '72g', mf: '7g',
    ings: [['Frozen strawberries', '3/4 cup each'], ['Frozen banana', '1/2 each'], ['Almond milk', '240ml / 300ml'], ['Whey protein vanilla', '1 scoop each'], ['Chia seeds', '1 tbsp each'], ['Rolled oats', '1/4 cup each'], ['Creatine monohydrate', '3-5g (1 tsp) each'], ['Medjool dates, pitted', '1 each (soaked 10 min in warm water)'], ['Matcha powder', '1 tsp each'], ['PB2 powder', '1 tbsp each'], ['Vanilla extract', '1/4 tsp'], ['Ice', '4 cubes']],
    steps: ['Soak date in warm water 10 min, drain.', 'Blend oats, almond milk, and soaked date first for 30 seconds until completely smooth.', 'Whisk matcha with 2 tbsp warm water until fully dissolved, then add to blender with creatine and remaining ingredients.', 'Blend 45 seconds. Pour immediately - matcha oxidizes over time.'],
    tip: 'The date balances matcha\'s bitterness more naturally than any other sweetener. Substantial enough to fully replace breakfast.',
  },
  {
    cat: 'smoothie', type: 'Smoothie', color: 'var(--blue)', sc: 'cb', name: 'Jamaica Hibiscus and Berry Refresh',
    tag: 'Hydration + probiotic focus', prepL: 'Prep ahead', prepC: 'var(--teal)', hk: 250, hp: '11g', hc: '44g', hf: '4g', mk: 310, mp: '13g', mc: '54g', mf: '5g',
    ings: [['Fermented agua de jamaica or strong brew cooled', '180ml each'], ['Frozen mixed berries', '3/4 cup each'], ['Frozen banana', '1/2 each'], ['Greek yogurt 0%', '60g / 80g'], ['Chia seeds', '1 tbsp each'], ['Creatine monohydrate', '3-5g (1 tsp) each'], ['Lime juice', '1 tbsp each'], ['Honey', '1/2 tsp each'], ['Ice', '4 cubes']],
    steps: ['Brew jamaica: simmer 1/2 cup dried hibiscus in 2 cups water 10 min. Cool completely (or use fermented version).', 'Add creatine and all remaining ingredients. Blend 45 seconds.', 'Serve immediately over ice with a lime wedge.'],
    tip: 'Creatine dissolves completely and is completely tasteless. Using fermented jamaica makes this probiotic-rich and antioxidant-forward.',
  },
  {
    cat: 'lunch', type: 'Lunch', color: 'var(--green)', sc: 'cg', name: 'Zaatar Chicken and Arugula Bowl',
    tag: '15 min with pre-cooked chicken', prepL: 'Quick', prepC: 'var(--green)', hk: 390, hp: '38g', hc: '22g', hf: '16g', mk: 480, mp: '46g', mc: '28g', mf: '18g',
    ings: [['Chicken breast or thigh, cooked', '4 oz / 6 oz'], ['Arugula or mixed greens', '2 cups each'], ['Cherry tomatoes', '1/2 cup each'], ['Cucumber, sliced', '1/4 cup each'], ['Kalamata olives', '5 each'], ['Feta crumbles', '1.5 tbsp each'], ['Zaatar', '1 tsp'], ['Olive oil', '1 tsp each'], ['Lemon juice', '1.5 tbsp each']],
    steps: ['Slice cooked chicken. Toss with za\'atar and a few drops of olive oil.', 'Build bowl: arugula, tomatoes, cucumber, olives.', 'Top with chicken and feta. Dress with lemon juice and remaining oil.'],
    tip: "Za'atar turns a simple chicken salad into something entirely intentional. Make double chicken on Sunday.",
  },
  {
    cat: 'lunch', type: 'Lunch', color: 'var(--green)', sc: 'cg', name: 'Guajillo Lentil Soup',
    tag: 'Batch cook Sunday - reheats perfectly', prepL: 'Prep ahead', prepC: 'var(--teal)', hk: 330, hp: '20g', hc: '48g', hf: '8g', mk: 400, mp: '24g', mc: '58g', mf: '9g',
    ings: [['Green or brown lentils, rinsed', '1 cup (makes 4 servings)'], ['Yellow onion, diced', '1'], ['Garlic cloves, minced', '4'], ['Canned diced tomatoes', '1 x 14 oz'], ['Low-sodium chicken broth', '4 cups'], ['Guajillo chile powder', '1.5 tsp'], ['Cumin', '1 tsp'], ['Smoked paprika', '1 tsp'], ['Turmeric', '1/2 tsp'], ['Olive oil', '1 tbsp'], ['Lemon juice', '2 tbsp'], ['Fresh parsley', '1/4 cup']],
    steps: ['Saute onion 5 min, add garlic 2 min.', 'Add guajillo, cumin, paprika, turmeric - stir 1 min. Add lentils, tomatoes, broth. Simmer 25-30 min.', 'Finish with lemon juice and parsley.'],
    tip: '18g protein + 16g fiber per cup. The guajillo gives deep smoky complexity. Makes 4 lunches from one cook.',
  },
  {
    cat: 'lunch', type: 'Lunch', color: 'var(--green)', sc: 'cg', name: 'Chipotle Chickpea Lettuce Wraps',
    tag: '10 min - no cook needed', prepL: 'Quick', prepC: 'var(--green)', hk: 345, hp: '16g', hc: '38g', hf: '14g', mk: 420, mp: '20g', mc: '46g', mf: '16g',
    ings: [['Canned chickpeas, rinsed', '1/2 cup / 3/4 cup'], ['Avocado', '1/2 each'], ['Cherry tomatoes, halved', '1/2 cup each'], ['Red onion, diced', '2 tbsp each'], ['Chipotle chili powder', '1/2 tsp each'], ['Lime juice', '1 tbsp each'], ['Lettuce leaves', '4-5 each'], ['Greek yogurt', '2 tbsp each']],
    steps: ['Mash avocado with lime juice, cumin, salt, chipotle powder.', 'Combine chickpeas, tomatoes, onion with lime.', 'Spoon into lettuce cups. Top with chickpea mix and Greek yogurt.'],
    tip: 'Lettuce instead of tortillas saves ~150 kcal. The crunch is actually better.',
  },
  {
    cat: 'lunch', type: 'Lunch', color: 'var(--green)', sc: 'cg', name: 'Quinoa Power Bowl',
    tag: 'Meal prep - 4 servings', prepL: 'Prep ahead', prepC: 'var(--teal)', hk: 400, hp: '38g', hc: '32g', hf: '12g', mk: 490, mp: '46g', mc: '39g', mf: '14g',
    ings: [['Quinoa, rinsed', '1/2 cup dry per 2 servings'], ['Chicken thighs cooked and sliced', '4 oz / 6 oz'], ['Avocado', '1/4 / 1/2'], ['Cherry tomatoes', '1/2 cup each'], ['Cucumber', '1/4 cup each'], ['Feta crumbles', '1 tbsp each'], ['Lemon tahini: tahini 1 tbsp', 'lemon juice 1.5 tbsp, water 1 tbsp, garlic'], ['Fresh parsley', '2 tbsp each']],
    steps: ['Cook quinoa per package. Cool.', 'Build bowls: quinoa base, chicken, tomatoes, cucumber, avocado.', 'Whisk tahini dressing ingredients with a pinch of cumin and drizzle over.', 'Top with feta and parsley.'],
    tip: 'Lemon tahini dressing is the hero. Make a double batch - keeps 5 days refrigerated.',
  },
  {
    cat: 'dinner', type: 'Dinner', color: 'var(--coral)', sc: 'cc', name: 'Guajillo and Herb Chicken Thighs',
    tag: 'Marinate AM - bake 35 min', prepL: '35 min', prepC: 'var(--amber)', hk: 410, hp: '42g', hc: '12g', hf: '20g', mk: 510, mp: '52g', mc: '14g', mf: '24g',
    ings: [['Bone-in chicken thighs', '2 each'], ['Guajillo chile powder', '2 tsp'], ['Smoked paprika', '1 tsp'], ['Cumin', '1 tsp'], ['Garlic powder', '1 tsp'], ['Oregano dry', '1 tsp'], ['Avocado oil', '1.5 tbsp'], ['Lime juice', '2 tbsp'], ['Cherry tomatoes', '1 cup'], ['Fresh parsley', '2 tbsp']],
    steps: ['Morning: combine spices, oil, lime juice into a paste. Rub all over chicken. Refrigerate all day.', 'Preheat 425F. Roast chicken skin-up on rack 35-38 min until charred and 175F internal.', 'Rest 5 min. Remove skin if reducing fat. Plate with roasted tomatoes and parsley.'],
    tip: 'Guajillo has a rich, berry-like heat - deeper than cayenne. This is the dinner that makes weight loss feel like a lifestyle.',
  },
  {
    cat: 'dinner', type: 'Dinner', color: 'var(--coral)', sc: 'cc', name: "Salmon with Za'atar and Crispy Chickpeas",
    tag: '30 min - sheet pan', prepL: '30 min', prepC: 'var(--amber)', hk: 440, hp: '42g', hc: '24g', hf: '20g', mk: 540, mp: '52g', mc: '30g', mf: '23g',
    ings: [['Salmon fillets skin-on', '5 oz / 7 oz'], ['Canned chickpeas very dry', '1 x 15 oz can'], ["Za'atar", '3 tsp total'], ['Olive oil', '2 tbsp'], ['Lemon, zested and juiced', '1'], ['Baby spinach', '2 cups'], ['White sesame seeds', '1 tsp'], ['Flaky salt', 'to finish']],
    steps: ["Preheat 425F. Pat chickpeas completely dry. Toss with 1 tbsp oil, za'atar, garlic powder. Roast 20 min.", "Push chickpeas aside. Place salmon skin-down. Rub with oil, za'atar, lemon zest, salt.", 'Roast salmon 10-12 min until flakes. Wilt spinach separately.', 'Plate salmon over spinach, top with chickpeas, sesame, lemon juice, flaky salt.'],
    tip: "Za'atar on salmon sounds unusual and tastes extraordinary. Crispy chickpeas replace a carb side while being more interesting.",
  },
  {
    cat: 'dinner', type: 'Dinner', color: 'var(--coral)', sc: 'cc', name: 'Soy-Ginger Salmon with Roasted Broccoli',
    tag: 'Marinate AM - cook 12 min', prepL: '25 min', prepC: 'var(--amber)', hk: 430, hp: '40g', hc: '18g', hf: '22g', mk: 530, mp: '50g', mc: '22g', mf: '26g',
    ings: [['Salmon fillets skin-on', '5 oz / 7 oz'], ['Broccoli florets', '3 cups'], ['Low-sodium soy sauce / tamari', '3 tbsp'], ['Sesame oil', '1 tbsp'], ['Fresh ginger, grated', '1 tsp'], ['Garlic, minced', '2 cloves'], ['Honey', '1 tsp'], ['Lime juice', '1 tbsp'], ['White sesame seeds', '1 tsp each'], ['Lime wedges', 'to serve']],
    steps: ['Morning: whisk soy sauce, sesame oil, ginger, garlic, honey, lime juice. Pour over salmon in zip-lock. Refrigerate all day.', 'Evening: preheat 425F. Roast broccoli with olive oil 20 min.', 'Heat oven-safe skillet medium-high. Sear salmon skin-down 3-4 min. Flip, pour marinade over, oven 5-6 min.', 'Serve with broccoli, sesame seeds, lime.'],
    tip: 'The morning marinade does all the flavor work. Most impressive dinner of the week.',
  },
  {
    cat: 'dinner', type: 'Dinner', color: 'var(--coral)', sc: 'cc', name: 'Chipotle Black Bean and Chicken Sausage Skillet',
    tag: 'One pan - 25 min', prepL: '25 min', prepC: 'var(--amber)', hk: 400, hp: '32g', hc: '36g', hf: '15g', mk: 490, mp: '40g', mc: '44g', mf: '17g',
    ings: [['Chicken sausage links, sliced', '2 / 3 links'], ['Canned black beans, rinsed', '1/2 cup / 3/4 cup'], ['Bell peppers, sliced', '1'], ['Yellow onion, sliced', '1/2'], ['Cherry tomatoes', '1 cup'], ['Garlic', '3 cloves'], ['Chipotle chili powder', '1 tsp'], ['Cumin', '1/2 tsp'], ['Avocado oil', '1 tbsp'], ['Lime juice', '1.5 tbsp'], ['Light sour cream', '2 tbsp each']],
    steps: ['Brown sausage slices 3-4 min. Remove.', 'Saute onion + peppers 4 min. Add garlic 1 min. Add spices 30 sec.', 'Add tomatoes + beans 4 min. Return sausage. Squeeze lime.', 'Serve in bowls, tortillas, or over cauliflower rice with sour cream.'],
    tip: 'Three serving options from one pan - that\'s why you\'ll actually make this regularly.',
  },
  {
    cat: 'dinner', type: 'Dinner', color: 'var(--coral)', sc: 'cc', name: 'Tuscan White Bean Chicken Skillet',
    tag: 'One pan - 30 min', prepL: '30 min', prepC: 'var(--amber)', hk: 440, hp: '42g', hc: '28g', hf: '16g', mk: 540, mp: '52g', mc: '34g', mf: '18g',
    ings: [['Chicken breasts pounded thin', '5 oz / 7 oz'], ['Canned chickpeas, rinsed', '1/2 cup / 3/4 cup'], ['Canned diced tomatoes', '1 x 14 oz'], ['Baby spinach', '2 cups'], ['Sun-dried tomatoes', '2 tbsp'], ['Garlic', '3 cloves'], ['Chicken broth', '1/2 cup'], ['Italian seasoning', '1 tsp'], ['Parmesan, grated', '1 tbsp each'], ['Fresh basil', 'handful']],
    steps: ['Sear chicken 4 min per side. Remove.', 'Saute garlic 1 min. Add sun-dried tomatoes, canned tomatoes, broth. Simmer 5 min.', 'Add chickpeas + spinach. Return chicken. Simmer 5 min.', 'Finish with basil and Parmesan.'],
    tip: 'The chickpeas add fiber that makes satiety last well into the next morning. Best Friday dinner.',
  },
  {
    cat: 'dinner', type: 'Dinner', color: 'var(--coral)', sc: 'cc', name: 'Shakshuka with Feta',
    tag: 'One pan - 20 min', prepL: '20 min', prepC: 'var(--amber)', hk: 380, hp: '24g', hc: '30g', hf: '17g', mk: 470, mp: '30g', mc: '36g', mf: '20g',
    ings: [['Whole eggs', '2 / 3'], ['Canned crushed tomatoes', '1 x 14 oz'], ['Bell pepper, diced', '1'], ['Yellow onion, diced', '1/2'], ['Garlic', '3 cloves'], ['Chipotle or smoked paprika', '1 tsp'], ['Cumin', '1 tsp'], ['Feta crumbles', '2 tbsp each'], ['Olive oil', '1 tbsp'], ['Fresh parsley', '2 tbsp']],
    steps: ['Saute onion + pepper 5 min. Add garlic and spices 1 min.', 'Add tomatoes. Simmer 8-10 min until thickened.', 'Make wells. Crack eggs in. Cover 5-7 min until whites set, yolks runny.', 'Finish with feta and parsley.'],
    tip: 'Wednesday night dinner. Scales to any size. Serve with low-carb bread if desired.',
  },
  {
    cat: 'dinner', type: 'Dinner', color: 'var(--coral)', sc: 'cc', name: 'Shrimp and Cauliflower Rice Bowl',
    tag: '15 min - low carb', prepL: '15 min', prepC: 'var(--green)', hk: 390, hp: '34g', hc: '35g', hf: '12g', mk: 480, mp: '42g', mc: '42g', mf: '14g',
    ings: [['Large shrimp peeled', '4 oz / 6 oz'], ['Cauliflower rice frozen', '1.5 cups each'], ['Baby spinach', '1 cup each'], ['Cherry tomatoes', '1/2 cup each'], ['Garlic', '3 cloves'], ['Lime juice', '2 tbsp'], ['Smoked paprika', '1 tsp'], ['Cumin', '1/2 tsp'], ['Avocado oil', '1 tbsp'], ['Greek yogurt', '2 tbsp each']],
    steps: ['Season shrimp with paprika, cumin, salt. Sear 90 sec per side. Remove.', 'Same pan: saute garlic 1 min. Add cauliflower rice + spinach 4-5 min.', 'Add tomatoes 2 min. Return shrimp. Squeeze lime.', 'Serve with Greek yogurt as sauce.'],
    tip: 'Cauliflower rice is genuinely satisfying when well-seasoned. The yogurt sauce is everything.',
  },
  {
    cat: 'dessert', type: 'Dessert', color: 'var(--purple)', sc: 'cp', name: 'Strawberry Banana Nice Cream',
    tag: '5 min - 2 ingredients - no sugar added', prepL: 'Prep ahead', prepC: 'var(--teal)', hk: 140, hp: '2g', hc: '34g', hf: '1g', mk: 180, mp: '3g', mc: '44g', mf: '1g',
    ings: [['Frozen bananas', '1 / 1.5'], ['Frozen strawberries', '1/2 cup / 3/4 cup'], ['Vanilla extract', '1/4 tsp'], ['Flaky salt', 'pinch'], ['Walnuts topping optional', '1 tbsp / 1.5 tbsp']],
    steps: ['Slice ripe bananas and freeze overnight - fully frozen, not just cold.', 'Blend frozen banana + strawberries + vanilla until smooth (~90 sec). Scrape sides as needed.', 'Serve immediately for soft-serve, or freeze 30 min for scoopable. Top with walnuts and flaky salt.'],
    tip: 'The flaky salt is non-negotiable - it makes the sweetness pop. No added sugar, no dairy.',
  },
  {
    cat: 'dessert', type: 'Dessert', color: 'var(--purple)', sc: 'cp', name: 'Dark Chocolate and Date Energy Bites',
    tag: 'No bake - freezer-friendly - makes 12', prepL: 'Prep ahead', prepC: 'var(--teal)', hk: 160, hp: '5g', hc: '22g', hf: '7g', mk: 160, mp: '5g', mc: '22g', mf: '7g',
    ings: [['Medjool dates, pitted', '8 (makes 12 bites)'], ['Rolled oats', '1/2 cup'], ['PB2 powder', '3 tbsp'], ['Cocoa powder, unsweetened', '2 tbsp'], ['Chia seeds', '1 tbsp'], ['Vanilla extract', '1/2 tsp'], ['Cinnamon', '1/4 tsp'], ['Dark chocolate 70%, chopped', '1 oz'], ['Flaky salt', 'pinch on top']],
    steps: ['Soak dates in warm water 5 min if not soft. Drain.', 'Blend dates until a sticky paste forms.', 'Add oats, PB2, cocoa, chia, vanilla, cinnamon. Pulse until combined.', 'Fold in chocolate pieces. Roll into 12 balls. Top each with flaky salt.', 'Refrigerate 30 min. Store fridge 1 week or freezer 1 month.'],
    tip: 'Two bites = ~320 kcal, 10g protein. Replaces Kind bars completely.',
  },
  {
    cat: 'dessert', type: 'Dessert', color: 'var(--purple)', sc: 'cp', name: 'Greek Yogurt Bark',
    tag: 'Freeze 2 hrs - 5 min prep', prepL: 'Prep ahead', prepC: 'var(--teal)', hk: 175, hp: '14g', hc: '16g', hf: '6g', mk: 220, mp: '17g', mc: '20g', mf: '8g',
    ings: [['Greek yogurt 0%', '200g / 250g'], ['Honey', '1 tsp / 1.5 tsp'], ['Vanilla extract', '1/4 tsp'], ['Strawberries, sliced', '1/2 cup each'], ['Pistachios, chopped', '15g / 20g'], ['Chia seeds', '1 tsp each'], ['Dark chocolate, shaved', '10g total'], ['Flaky salt', 'pinch']],
    steps: ['Line a small sheet with parchment. Mix yogurt with honey and vanilla. Spread 1/4-inch thick.', 'Scatter strawberries, pistachios, chia, and dark chocolate on top. Pinch of flaky salt.', 'Freeze at least 2 hours until solid.', 'Break into pieces. Serve immediately - it melts fast. Store airtight in freezer.'],
    tip: 'Tastes like frozen cheesecake. High protein at under 220 kcal.',
  },
  {
    cat: 'dessert', type: 'Dessert', color: 'var(--purple)', sc: 'cp', name: 'Spiced Baked Apples with Walnuts',
    tag: '20 min - warm - no added sugar', prepL: '20 min', prepC: 'var(--amber)', hk: 180, hp: '4g', hc: '28g', hf: '8g', mk: 210, mp: '5g', mc: '32g', mf: '9g',
    ings: [['Apples Honeycrisp or Gala', '1 each'], ['Walnuts, chopped', '15g / 20g'], ['Raisins', '1 tbsp each'], ['Cinnamon', '1/2 tsp each'], ['Nutmeg', 'pinch'], ['Ginger powder', 'pinch'], ['Maple syrup', '1 tsp / 1.5 tsp'], ['Greek yogurt', '3 tbsp / 4 tbsp to serve']],
    steps: ['Preheat 375F. Core apples leaving bottom intact.', 'Mix walnuts, raisins, cinnamon, nutmeg, ginger, maple syrup. Stuff into wells.', 'Bake in dish with 1/4 cup water at bottom 20-25 min until caramelized.', 'Serve warm with cold Greek yogurt - the temperature contrast is the whole point.'],
    tip: '~1 tsp maple syrup is the only added sugar. Natural sugars in apple and raisins do the rest.',
  },
  {
    cat: 'ferments', type: 'Ferment', color: 'var(--teal)', sc: 'ct', name: 'Curtido',
    tag: '5 min prep - ready in 24-48 hrs - Mexican lacto-ferment', prepL: 'Prep ahead', prepC: 'var(--teal)', hk: 25, hp: '1g', hc: '5g', hf: '0g', mk: 25, mp: '1g', mc: '5g', mf: '0g',
    ings: [['Green cabbage, shredded', '1/2 head (~4 cups)'], ['Carrot, grated', '1 medium'], ['Red onion, thinly sliced', '1/2'], ['Jalapeno, sliced optional', '1'], ['Dried oregano', '1 tsp'], ['Red pepper flakes', '1/4 tsp'], ['Pink salt non-iodized', '1.5 tsp'], ['Lime juice', '2 tbsp'], ['Apple cider vinegar raw with mother', '2 tbsp'], ['Filtered water', 'enough to submerge']],
    steps: ['Combine cabbage, carrot, onion, jalapeno in bowl. Add salt and massage firmly 3-4 min until vegetables release liquid and soften.', 'Add oregano, pepper flakes, lime juice, and ACV. Toss well.', 'Pack tightly into mason jar, pressing so liquid rises above vegetables. Add filtered water if needed to submerge.', 'Weight vegetables down. Cover loosely with cloth. Leave at room temp 24-48 hrs.', 'Taste at 24 hrs - should be bright and pleasantly sour. Refrigerate. Keeps 2-3 weeks.'],
    tip: 'Use pink Himalayan salt only - iodized salt kills beneficial bacteria. Raw ACV with the mother jump-starts fermentation. Serve as a probiotic side at any meal.',
  },
  {
    cat: 'ferments', type: 'Ferment', color: 'var(--teal)', sc: 'ct', name: 'Agua de Jamaica Fermentada',
    tag: '5 min prep - ferments 48 hrs - zero new ingredients', prepL: 'Prep ahead', prepC: 'var(--teal)', hk: 30, hp: '0g', hc: '8g', hf: '0g', mk: 30, mp: '0g', mc: '8g', mf: '0g',
    ings: [['Dried jamaica hibiscus flowers', '1/2 cup'], ['Filtered water', '4 cups + 4 cups'], ['Raw honey', '1-2 tbsp'], ['Cinnamon stick', '1'], ['Star anise optional', '1'], ['Fresh ginger sliced optional', '3 coins'], ['Lime juice', '2 tbsp - add after fermentation']],
    steps: ['Simmer jamaica, cinnamon, star anise, ginger in 4 cups water 10 min. Strain. Stir in honey while warm.', 'Cool COMPLETELY to room temperature - heat kills bacteria.', 'Add 4 cups filtered water. Pour into clean jar. Cover with cloth secured with rubber band. Leave at room temp 48 hrs.', 'Small bubbles = active fermentation. Taste at 48 hrs - tart and slightly effervescent.', 'Add lime juice, stir, seal, refrigerate. Keeps 1 week.'],
    tip: 'Honey is consumed during fermentation - final drink has much less sugar. Drink 4-6 oz daily with a meal. Don\'t use tap water - chlorine inhibits fermentation.',
  },
]
