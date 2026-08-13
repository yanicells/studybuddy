import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: StudybuddyPage,
})

function StudybuddyPage() {
  return (
    <main className="scaffold">
      <div className="brand-mark" aria-hidden="true">S</div>
      <h1>Studybuddy</h1>
      <p>The TanStack workspace is ready.</p>
    </main>
  )
}
