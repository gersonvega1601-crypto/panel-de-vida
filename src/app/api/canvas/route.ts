import { NextResponse } from 'next/server'

export async function GET() {
  const ICS_URL = 'https://swau.instructure.com/feeds/calendars/user_ApofzG02TfXbGyquXmxbq2I7hBR99KGyLL6SpNrR.ics'

  try {
    const response = await fetch(ICS_URL)
    if (!response.ok) throw new Error('No se pudo conectar con el calendario de Canvas')
    
    const text = await response.text()

    // Procesador básico de eventos ICS
    const events: { title: string; date: string; description?: string }[] = []
    const lineas = text.split(/\r?\n/)

    let currentEvent: { title?: string; date?: string; description?: string } = {}

    for (const linea of lineas) {
      if (linea === 'BEGIN:VEVENT') {
        currentEvent = {}
      } else if (linea === 'END:VEVENT') {
        if (currentEvent.title && currentEvent.date) {
          events.push(currentEvent as { title: string; date: string; description?: string })
        }
      } else if (linea.startsWith('SUMMARY:')) {
        currentEvent.title = linea.replace('SUMMARY:', '').trim()
      } else if (linea.startsWith('DTSTART:')) {
        const rawDate = linea.replace('DTSTART:', '').trim()
        // Formatear fecha básica de ICS (YYYYMMDD) a legible
        if (rawDate.length >= 8) {
          const year = rawDate.substring(0, 4)
          const month = rawDate.substring(4, 6)
          const day = rawDate.substring(6, 8)
          currentEvent.date = `${month}/${day}/${year}`
        } else {
          currentEvent.date = 'Próximamente'
        }
      }
    }

    // Ordenar y limitar a las próximas 5 tareas
    return NextResponse.json({ success: true, events: events.slice(0, 5) })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Error al sincronizar Canvas', details: String(error) }, { status: 500 })
  }
}