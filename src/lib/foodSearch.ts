import type { NutriInfo } from '../data/grocery'

const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1'

interface USDANutrient {
  nutrientId: number
  value: number
}

interface USDAFood {
  servingSize?: number
  servingSizeUnit?: string
  foodNutrients: USDANutrient[]
}

interface USDASearchResponse {
  foods?: USDAFood[]
}

function get(nutrients: USDANutrient[], id: number): number {
  return nutrients.find(n => n.nutrientId === id)?.value ?? 0
}

function r1(n: number): number {
  return Math.round(n * 10) / 10
}

// USDA FoodData Central — Foundation and SR Legacy foods return nutrients per 100 g.
// Docs: https://api.nal.usda.gov/fdc/v1/foods/search
export async function searchUSDA(query: string, signal?: AbortSignal): Promise<NutriInfo | null> {
  const apiKey = (import.meta.env.VITE_USDA_API_KEY as string | undefined) || 'DEMO_KEY'
  const url = `${USDA_BASE}/foods/search?` + new URLSearchParams({
    query,
    api_key: apiKey,
    pageSize: '5',
    dataType: 'Foundation,SR Legacy',
  })

  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`USDA ${res.status}`)

  const data: USDASearchResponse = await res.json()
  if (!data.foods?.length) return null

  const food = data.foods[0]
  const scale = food.servingSize ? food.servingSize / 100 : 1
  const srv = food.servingSize
    ? `${food.servingSize}${(food.servingSizeUnit ?? 'g').toLowerCase()}`
    : '100g'

  const ns = food.foodNutrients
  const fi100 = get(ns, 1079)

  return {
    srv,
    cal: Math.round(get(ns, 1008) * scale),
    p:   r1(get(ns, 1003) * scale),
    c:   r1(get(ns, 1005) * scale),
    f:   r1(get(ns, 1004) * scale),
    fi:  fi100 > 0 ? r1(fi100 * scale) : undefined,
  }
}
