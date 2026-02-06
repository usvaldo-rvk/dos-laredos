import { QRCodeSVG } from 'qrcode.react'
import { Printer, Download } from 'lucide-react'
import { useRef } from 'react'

interface QRCodeDisplayProps {
  value: string
  size?: number
  showValue?: boolean
  title?: string
  subtitle?: string
  printable?: boolean
}

export default function QRCodeDisplay({
  value,
  size = 200,
  showValue = true,
  title,
  subtitle,
  printable = true
}: QRCodeDisplayProps) {
  const qrRef = useRef<HTMLDivElement>(null)

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Por favor permite las ventanas emergentes para imprimir')
      return
    }

    // Formato optimizado para etiquetas de 88mm
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR - ${value}</title>
        <style>
          @page {
            size: 88mm auto;
            margin: 0;
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: Arial, sans-serif;
            width: 88mm;
            background: white;
            padding: 4mm;
          }
          .qr-container {
            text-align: center;
            width: 100%;
            border: 1.5px solid #000;
            border-radius: 4px;
            padding: 3mm;
          }
          .qr-header {
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding-bottom: 2mm;
            margin-bottom: 2mm;
            border-bottom: 1px dashed #999;
          }
          .qr-title {
            font-size: 12px;
            font-weight: bold;
            margin-bottom: 1mm;
            color: #000;
            line-height: 1.2;
          }
          .qr-subtitle {
            font-size: 9px;
            color: #444;
            margin-bottom: 3mm;
          }
          .qr-code {
            display: flex;
            justify-content: center;
            margin-bottom: 3mm;
          }
          .qr-code svg {
            width: 62mm !important;
            height: 62mm !important;
          }
          .qr-value {
            font-family: 'Courier New', monospace;
            font-size: 14px;
            font-weight: bold;
            letter-spacing: 1px;
            padding: 2mm 0;
            border-top: 1px dashed #999;
            margin-top: 2mm;
          }
          .qr-footer {
            font-size: 8px;
            color: #666;
            margin-top: 2mm;
          }
          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <div class="qr-container">
          <div class="qr-header">DOS LAREDOS</div>
          ${title ? `<div class="qr-title">${title}</div>` : ''}
          ${subtitle ? `<div class="qr-subtitle">${subtitle}</div>` : ''}
          <div class="qr-code">
            ${qrRef.current?.querySelector('svg')?.outerHTML || ''}
          </div>
          <div class="qr-value">${value}</div>
          <div class="qr-footer">${new Date().toLocaleDateString('es-MX')}</div>
        </div>
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() {
              window.close();
            }
          }
        </script>
      </body>
      </html>
    `)
    printWindow.document.close()
  }

  const handleDownload = () => {
    const svg = qrRef.current?.querySelector('svg')
    if (!svg) return

    // Create canvas from SVG
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const data = new XMLSerializer().serializeToString(svg)
    const img = new Image()

    canvas.width = size + 40
    canvas.height = size + 80

    img.onload = () => {
      if (!ctx) return

      // White background
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw QR code
      ctx.drawImage(img, 20, 20)

      // Draw text
      ctx.fillStyle = 'black'
      ctx.font = 'bold 14px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(value, canvas.width / 2, size + 50)

      // Download
      const link = document.createElement('a')
      link.download = `QR-${value}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    }

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(data)))
  }

  return (
    <div className="flex flex-col items-center">
      <div ref={qrRef} className="bg-white p-4 rounded-lg shadow-sm border">
        {title && (
          <p className="text-sm font-semibold text-center text-gray-700 mb-1">{title}</p>
        )}
        {subtitle && (
          <p className="text-xs text-center text-gray-500 mb-3">{subtitle}</p>
        )}
        <QRCodeSVG
          value={value}
          size={size}
          level="H"
          includeMargin={true}
        />
        {showValue && (
          <p className="font-mono text-lg font-bold text-center mt-3">{value}</p>
        )}
      </div>

      {printable && (
        <div className="flex gap-2 mt-4">
          <button
            onClick={handlePrint}
            className="btn-secondary flex items-center gap-2"
          >
            <Printer size={18} />
            Imprimir
          </button>
          <button
            onClick={handleDownload}
            className="btn-ghost flex items-center gap-2"
          >
            <Download size={18} />
            Descargar
          </button>
        </div>
      )}
    </div>
  )
}
