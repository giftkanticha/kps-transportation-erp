import 'dotenv/config'
import app from './app'

const PORT = parseInt(process.env.PORT || '3001')
app.listen(PORT, () => {
  console.log(`KPS ERP Server running on http://localhost:${PORT}`)
})
