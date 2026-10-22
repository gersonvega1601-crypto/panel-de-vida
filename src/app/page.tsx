'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Routine {
  title: string
  exercises: string[]
}

interface FoodItem {
  name: string
  calories: number
}

interface CanvasTask {
  title: string
  date: string
}

export default function Home() {
  const [streak, setStreak] = useState(12)
  const [gymDone, setGymDone] = useState(false)
  const [todayIndex, setTodayIndex] = useState(1)
  const [isEditingRoutines, setIsEditingRoutines] = useState(false)
  const [editingDay, setEditingDay] = useState<number>(1)

  // Canvas State
  const [canvasTasks, setCanvasTasks] = useState<CanvasTask[]>([])
  const [loadingCanvas, setLoadingCanvas] = useState<boolean>(true)

  // Nutrición
  const [calorieGoal, setCalorieGoal] = useState<number>(2200)
  const [isEditingGoal, setIsEditingGoal] = useState<boolean>(false)
  const [tempGoalInput, setTempGoalInput] = useState<string>('2200')
  const [foodList, setFoodList] = useState<FoodItem[]>([])
  const [foodNameInput, setFoodNameInput] = useState('')
  const [foodCalInput, setFoodCalInput] = useState('')

  // Rutinas
  const [weekRoutines, setWeekRoutines] = useState<{ [key: number]: Routine }>({
    1: { title: 'Pecho & Tríceps (Hipertrofia)', exercises: ['Press de Banca Cerrado (4x10)', 'Aperturas con Mancuerna (3x12)', 'Fondos / Tríceps Polea (4x12)'] },
    2: { title: 'Espalda & Bíceps', exercises: ['Jalón al Pecho (4x10)', 'Remo con Barra (4x10)', 'Curl de Bíceps con Barra Z (3x12)'] },
    3: { title: 'Pierna Completa', exercises: ['Sentadilla Libre (4x8)', 'Prensa de Piernas (4x10)', 'Peso Muerto Rumano (3x10)'] },
    4: { title: 'Hombro & Core', exercises: ['Press Militar (4x10)', 'Elevaciones Laterales (4x15)', 'Planchas (3x60s)'] },
    5: { title: 'Brazos & Enfoque Hipertrofia', exercises: ['Curl Martillo (4x10)', 'Press Francés (4x10)', 'Elevaciones Posteriores (3x15)'] },
    6: { title: 'Descanso Activo / Cardio', exercises: ['Caminata inclinada 30 min', 'Estiramientos'] },
    0: { title: 'Descanso Total', exercises: ['Recuperación muscular'] },
  })

  const [newExerciseInput, setNewExerciseInput] = useState('')

  const daysMap: { [key: number]: string } = {
    1: 'Lunes',
    2: 'Martes',
    3: 'Miércoles',
    4: 'Jueves',
    5: 'Viernes',
    6: 'Sábado',
    0: 'Domingo',
  }

  useEffect(() => {
    setTodayIndex(new Date().getDay())
    setEditingDay(new Date().getDay())

    fetch('/api/canvas')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.events) {
          setCanvasTasks(data.events)
        }
      })
      .catch((err) => console.error('Error cargando Canvas:', err))
      .finally(() => setLoadingCanvas(false))

    const loadUserData = async () => {
      const { data, error } = await supabase.from('user_data').select('*').eq('id', 'main_user').single()
      if (data && !error) {
        if (data.streak !== undefined) setStreak(data.streak)
        if (data.gym_done !== undefined) setGymDone(data.gym_done)
        if (data.calorie_goal) {
          setCalorieGoal(data.calorie_goal)
          setTempGoalInput(data.calorie_goal.toString())
        }
        if (data.food_list) setFoodList(data.food_list)
        if (data.week_routines) setWeekRoutines(data.week_routines)
      }
    }

    loadUserData()
  }, [])

  const saveDataToSupabase = async (updatedFields: Record<string, unknown>) => {
    await supabase.from('user_data').upsert({
      id: 'main_user',
      ...updatedFields,
      updated_at: new Date().toISOString(),
    })
  }

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    })
  }

  const currentRoutine = weekRoutines[todayIndex] || weekRoutines[1]

  const handleGymCheck = () => {
    const newStreak = !gymDone ? streak + 1 : streak - 1
    const newGymDone = !gymDone
    setStreak(newStreak)
    setGymDone(newGymDone)
    saveDataToSupabase({ streak: newStreak, gym_done: newGymDone })
  }

  const handleUpdateTitle = (newTitle: string) => {
    const updated = {
      ...weekRoutines,
      [editingDay]: { ...weekRoutines[editingDay], title: newTitle },
    }
    setWeekRoutines(updated)
    saveDataToSupabase({ week_routines: updated })
  }

  const handleAddExercise = () => {
    if (!newExerciseInput.trim()) return
    const updated = {
      ...weekRoutines,
      [editingDay]: {
        ...weekRoutines[editingDay],
        exercises: [...weekRoutines[editingDay].exercises, newExerciseInput.trim()],
      },
    }
    setWeekRoutines(updated)
    setNewExerciseInput('')
    saveDataToSupabase({ week_routines: updated })
  }

  const handleRemoveExercise = (indexToRemove: number) => {
    const updated = {
      ...weekRoutines,
      [editingDay]: {
        ...weekRoutines[editingDay],
        exercises: weekRoutines[editingDay].exercises.filter((_, idx) => idx !== indexToRemove),
      },
    }
    setWeekRoutines(updated)
    saveDataToSupabase({ week_routines: updated })
  }

  // Lógica de Calorías (Restando del objetivo)
  const totalCaloriesConsumed = foodList.reduce((acc, item) => acc + item.calories, 0)
  const caloriesRemaining = calorieGoal - totalCaloriesConsumed
  const isOverLimit = caloriesRemaining < 0
  const caloriePercentage = Math.min(Math.round((totalCaloriesConsumed / calorieGoal) * 100), 100)

  const handleAddFood = () => {
    if (!foodNameInput.trim() || !foodCalInput) return
    const cals = parseInt(foodCalInput, 10)
    if (isNaN(cals) || cals <= 0) return

    const updatedFood = [...foodList, { name: foodNameInput.trim(), calories: cals }]
    setFoodList(updatedFood)
    setFoodNameInput('')
    setFoodCalInput('')
    saveDataToSupabase({ food_list: updatedFood })
  }

  const handleRemoveFood = (index: number) => {
    const updatedFood = foodList.filter((_, idx) => idx !== index)
    setFoodList(updatedFood)
    saveDataToSupabase({ food_list: updatedFood })
  }

  const handleSaveGoal = () => {
    const newGoal = parseInt(tempGoalInput, 10)
    if (!isNaN(newGoal) && newGoal > 0) {
      setCalorieGoal(newGoal)
      saveDataToSupabase({ calorie_goal: newGoal })
    }
    setIsEditingGoal(false)
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* ENCABEZADO MINIMALISTA */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-6 border-b border-neutral-800 gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Panel Personal</h1>
            <p className="text-xs text-neutral-400 mt-1">Organización diaria & Gimnasio</p>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={handleGoogleLogin}
              className="flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 px-4 py-2 rounded-xl text-xs font-semibold text-neutral-200 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              Iniciar sesión con Google
            </button>

            <div className="flex items-center gap-3 bg-neutral-900 border border-neutral-800 px-4 py-2 rounded-2xl">
              <span className="text-xl">🔥</span>
              <div>
                <p className="text-xs text-neutral-400 font-medium">Racha Gym</p>
                <p className="text-sm font-bold text-orange-500">{streak} Días seguidos</p>
              </div>
            </div>
          </div>
        </header>

        {/* GRID PRINCIPAL */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* SECCIÓN 1: CANVAS & AGENDA */}
          <section className="space-y-6">
            <h2 className="text-lg font-semibold text-neutral-200 border-l-2 border-indigo-500 pl-3">
              📅 Agenda & Tareas de Canvas
            </h2>

            <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 space-y-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Canvas SWAU (Sincronizado)</span>
                <span className="text-xs text-neutral-500">{canvasTasks.length} eventos</span>
              </div>
              
              {loadingCanvas ? (
                <p className="text-xs text-neutral-500 italic py-4 text-center">Cargando tareas de Canvas...</p>
              ) : canvasTasks.length === 0 ? (
                <p className="text-xs text-neutral-500 italic py-4 text-center">No hay tareas pendientes próximas en tu calendario de Canvas.</p>
              ) : (
                canvasTasks.map((task, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-neutral-950/50 rounded-xl border border-neutral-800/60">
                    <div>
                      <p className="text-sm font-medium text-neutral-200">{task.title}</p>
                      <p className="text-xs text-neutral-500">Fecha: {task.date}</p>
                    </div>
                    <span className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-1 rounded-md">Canvas</span>
                  </div>
                ))
              )}
            </div>

            <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 space-y-3">
              <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Correos del Día</span>
              <div className="p-3 bg-neutral-950/50 rounded-xl border border-neutral-800/60 space-y-1">
                <p className="text-sm font-medium text-neutral-200">Aviso de Campus / Universidad</p>
                <p className="text-xs text-neutral-400 line-clamp-1">Actualización de horarios para la siguiente semana de exámenes...</p>
              </div>
            </div>

            <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 space-y-3">
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">👥 Horario & Reuniones</span>
              <div className="flex justify-between items-center p-3 bg-neutral-950/50 rounded-xl border border-neutral-800/60">
                <div>
                  <p className="text-sm font-medium text-neutral-200">Clase General Biology</p>
                  <p className="text-xs text-neutral-500">Aula 102 • 10:00 AM - 11:30 AM</p>
                </div>
                <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-md">Hoy</span>
              </div>
            </div>
          </section>

          {/* SECCIÓN 2: GYM HUB & NUTRICIÓN */}
          <section className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-neutral-200 border-l-2 border-orange-500 pl-3">
                🏋️‍♂️ Gimnasio & Racha
              </h2>
              <button
                onClick={() => setIsEditingRoutines(!isEditingRoutines)}
                className="text-xs bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 px-3 py-1.5 rounded-lg text-neutral-300 font-medium transition-all cursor-pointer flex items-center gap-1.5"
              >
                ⚙️ {isEditingRoutines ? 'Cerrar Edición' : 'Editar Rutinas'}
              </button>
            </div>

            <div className="bg-gradient-to-br from-neutral-900 to-orange-950/30 border border-orange-500/20 rounded-2xl p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-semibold text-orange-400 uppercase tracking-wider">Motivación Diaria</span>
                  <h3 className="text-2xl font-bold text-white mt-1">¡No rompas la racha! 🔥</h3>
                  <p className="text-xs text-neutral-400 mt-1">Marca tu entrenamiento al finalizar para mantener tu nivel.</p>
                </div>
                <div className="text-4xl font-extrabold text-orange-500">{streak}</div>
              </div>

              <button
                onClick={handleGymCheck}
                className={`w-full py-3 rounded-xl font-semibold transition-all flex justify-center items-center gap-2 cursor-pointer ${
                  gymDone
                    ? 'bg-emerald-600 text-white border border-emerald-500 shadow-lg shadow-emerald-900/20'
                    : 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-900/20'
                }`}
              >
                {gymDone ? '✅ ¡Entrenamiento Registrado de Hoy!' : '⚡ Marcar Gimnasio como Completado'}
              </button>
            </div>

            {isEditingRoutines ? (
              <div className="bg-neutral-900/80 border border-orange-500/30 rounded-2xl p-6 space-y-5">
                <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
                  <h3 className="text-sm font-bold text-orange-400 uppercase tracking-wider">✏️ Configurar Rutinas Semanales</h3>
                  <span className="text-xs text-neutral-400">Selecciona el día a modificar</span>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                  {[1, 2, 3, 4, 5, 6, 0].map((dayNum) => (
                    <button
                      key={dayNum}
                      onClick={() => setEditingDay(dayNum)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                        editingDay === dayNum
                          ? 'bg-orange-500 text-white shadow-md shadow-orange-950'
                          : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
                      }`}
                    >
                      {daysMap[dayNum]}
                    </button>
                  ))}
                </div>

                <div className="space-y-4 pt-2">
                  <div>
                    <label className="text-xs text-neutral-400 block mb-1">Enfoque / Título ({daysMap[editingDay]}):</label>
                    <input
                      type="text"
                      value={weekRoutines[editingDay]?.title || ''}
                      onChange={(e) => handleUpdateTitle(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-neutral-400 block mb-1">Ejercicios actuales:</label>
                    <div className="space-y-2">
                      {weekRoutines[editingDay]?.exercises.map((ex, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-neutral-950/60 px-3 py-2 rounded-lg border border-neutral-800 text-sm">
                          <span className="text-neutral-200">{ex}</span>
                          <button
                            onClick={() => handleRemoveExercise(idx)}
                            className="text-xs text-red-400 hover:text-red-300 transition-all cursor-pointer font-bold px-1"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <input
                      type="text"
                      placeholder="Ej. Press de Banca (4x10)"
                      value={newExerciseInput}
                      onChange={(e) => setNewExerciseInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddExercise()}
                      className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                    />
                    <button
                      onClick={handleAddExercise}
                      className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                    >
                      + Añadir
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
                  <div>
                    <span className="text-xs text-neutral-400">Rutina Programada para Hoy</span>
                    <h3 className="text-base font-bold text-white">{currentRoutine.title}</h3>
                  </div>
                  <span className="text-xs bg-neutral-800 text-neutral-300 px-3 py-1 rounded-full">Día activo</span>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-neutral-400">Ejercicios sugeridos:</p>
                  <ul className="space-y-2">
                    {currentRoutine.exercises.map((exercise, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-neutral-300 bg-neutral-950/40 p-2.5 rounded-lg border border-neutral-800/40">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                        {exercise}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* SECCIÓN 3: CONTADOR DE CALORÍAS & NUTRICIÓN (MODO RESTRINGIDO / RESTA) */}
            <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6 space-y-6">
              <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
                <div>
                  <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Nutrición & Control de Tope</span>
                  <h3 className="text-base font-bold text-white">Contador de Calorías Restantes</h3>
                </div>
                <button
                  onClick={() => {
                    setIsEditingGoal(!isEditingGoal)
                    setTempGoalInput(calorieGoal.toString())
                  }}
                  className="text-xs bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 px-3 py-1.5 rounded-lg text-neutral-300 font-medium transition-all cursor-pointer"
                >
                  🎯 Editar Límite ({calorieGoal} kcal)
                </button>
              </div>

              {isEditingGoal && (
                <div className="bg-neutral-950 border border-emerald-500/30 p-4 rounded-xl space-y-3">
                  <p className="text-xs text-neutral-300 font-medium">Establecer límite máximo diario de calorías:</p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={tempGoalInput}
                      onChange={(e) => setTempGoalInput(e.target.value)}
                      className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      onClick={handleSaveGoal}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                    >
                      Guardar
                    </button>
                  </div>
                </div>
              )}

              {/* Barra de Progreso Inversa (Restante) */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-neutral-400">Consumidas: <strong className="text-neutral-200">{totalCaloriesConsumed} kcal</strong></span>
                  <span className="text-neutral-400">
                    {isOverLimit ? (
                      <strong className="text-red-400">Exceso: +{Math.abs(caloriesRemaining)} kcal ⚠️</strong>
                    ) : (
                      <span>Restantes: <strong className="text-emerald-400">{caloriesRemaining} kcal</strong></span>
                    )}
                  </span>
                </div>
                <div className="w-full bg-neutral-950 h-4 rounded-full overflow-hidden border border-neutral-800 p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isOverLimit ? 'bg-red-500' : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                    }`}
                    style={{ width: `${caloriePercentage}%` }}
                  ></div>
                </div>
                <p className="text-right text-[10px] text-neutral-500">
                  {isOverLimit ? '¡Has superado tu límite máximo!' : `${caloriePercentage}% del límite consumido`}
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-medium text-neutral-400">Alimentos registrados hoy:</p>
                {foodList.length === 0 ? (
                  <p className="text-xs text-neutral-500 italic text-center py-2">No hay alimentos registrados todavía.</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {foodList.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-neutral-950/50 px-3 py-2 rounded-xl border border-neutral-800/60 text-sm">
                        <span className="text-neutral-200">{item.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-semibold text-emerald-400">+{item.calories} kcal</span>
                          <button
                            onClick={() => handleRemoveFood(idx)}
                            className="text-xs text-red-400 hover:text-red-300 cursor-pointer font-bold px-1"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-2 border-t border-neutral-800">
                <p className="text-xs font-medium text-neutral-400">Registrar lo que comiste:</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Alimento (ej. Arroz con pollo)"
                    value={foodNameInput}
                    onChange={(e) => setFoodNameInput(e.target.value)}
                    className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  <input
                    type="number"
                    placeholder="Calorías"
                    value={foodCalInput}
                    onChange={(e) => setFoodCalInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddFood()}
                    className="w-24 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={handleAddFood}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap"
                  >
                    + Agregar
                  </button>
                </div>
              </div>

            </div>

          </section>

        </div>
      </div>
    </main>
  )
}