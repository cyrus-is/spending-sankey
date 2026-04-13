import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { sankey, sankeyLinkHorizontal, sankeyLeft } from 'd3-sankey'
import type { SankeyNodeMinimal, SankeyLinkMinimal } from 'd3-sankey'
import type { SankeyData } from '../lib/sankey'

interface SankeyChartProps {
  data: SankeyData
}

// d3-sankey node/link types
interface D3Node extends SankeyNodeMinimal<D3Node, D3Link> {
  id: string
  label: string
  color: string
  value: number
}

interface D3Link extends SankeyLinkMinimal<D3Node, D3Link> {
  value: number
}

const WIDTH = 900
const HEIGHT = 500
const MARGIN = { top: 10, right: 160, bottom: 10, left: 160 }

export function SankeyChart({ data }: SankeyChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || data.nodes.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const innerWidth = WIDTH - MARGIN.left - MARGIN.right
    const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom

    // Build id-to-index map
    const nodeIndexMap = new Map(data.nodes.map((n, i) => [n.id, i]))

    const sankeyNodes: D3Node[] = data.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      color: n.color,
      value: n.value,
    }))

    const sankeyLinks: D3Link[] = data.links.map((l) => ({
      source: nodeIndexMap.get(l.source) ?? 0,
      target: nodeIndexMap.get(l.target) ?? 0,
      value: l.value,
    }))

    const sankeyLayout = sankey<D3Node, D3Link>()
      .nodeId((d) => d.id)
      .nodeAlign(sankeyLeft)
      .nodeWidth(16)
      .nodePadding(12)
      .extent([
        [0, 0],
        [innerWidth, innerHeight],
      ])

    const { nodes, links } = sankeyLayout({
      nodes: sankeyNodes,
      links: sankeyLinks,
    })

    const g = svg
      .append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

    // Links
    g.append('g')
      .attr('fill', 'none')
      .selectAll('path')
      .data(links)
      .join('path')
      .attr('d', sankeyLinkHorizontal())
      .attr('stroke', (d) => {
        const source = d.source as D3Node
        return source.color
      })
      .attr('stroke-width', (d) => Math.max(1, d.width ?? 1))
      .attr('stroke-opacity', 0.3)
      .on('mouseover', function () {
        d3.select(this).attr('stroke-opacity', 0.6)
      })
      .on('mouseout', function () {
        d3.select(this).attr('stroke-opacity', 0.3)
      })
      .append('title')
      .text((d) => {
        const src = d.source as D3Node
        const tgt = d.target as D3Node
        return `${src.label} → ${tgt.label}\n$${d.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      })

    // Node rectangles
    const nodeGroup = g
      .append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')

    nodeGroup
      .append('rect')
      .attr('x', (d) => d.x0 ?? 0)
      .attr('y', (d) => d.y0 ?? 0)
      .attr('width', (d) => (d.x1 ?? 0) - (d.x0 ?? 0))
      .attr('height', (d) => Math.max(1, (d.y1 ?? 0) - (d.y0 ?? 0)))
      .attr('fill', (d) => d.color)
      .attr('rx', 2)
      .append('title')
      .text(
        (d) =>
          `${d.label}\n$${(d.value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      )

    // Node labels
    nodeGroup
      .append('text')
      .attr('x', (d) => ((d.x0 ?? 0) < innerWidth / 2 ? (d.x1 ?? 0) + 6 : (d.x0 ?? 0) - 6))
      .attr('y', (d) => ((d.y1 ?? 0) + (d.y0 ?? 0)) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', (d) => ((d.x0 ?? 0) < innerWidth / 2 ? 'start' : 'end'))
      .attr('font-size', '11px')
      .attr('fill', '#e2e8f0')
      .text((d) => {
        const val = (d.value ?? 0).toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0,
        })
        return `${d.label} ${val}`
      })
  }, [data])

  if (data.nodes.length === 0) return null

  return (
    <div className="sankey-wrap">
      <div className="sankey-summary">
        <div className="sankey-summary__item sankey-summary__item--income">
          <span className="sankey-summary__label">Total Income</span>
          <span className="sankey-summary__value">
            ${data.totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="sankey-summary__item sankey-summary__item--expense">
          <span className="sankey-summary__label">Total Expenses</span>
          <span className="sankey-summary__value">
            ${data.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div
          className={`sankey-summary__item ${data.totalIncome >= data.totalExpenses ? 'sankey-summary__item--positive' : 'sankey-summary__item--negative'}`}
        >
          <span className="sankey-summary__label">Net</span>
          <span className="sankey-summary__value">
            {data.totalIncome >= data.totalExpenses ? '+' : '-'}$
            {Math.abs(data.totalIncome - data.totalExpenses).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
      </div>
      <div className="sankey-svg-wrap">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          width="100%"
          height={HEIGHT}
          style={{ display: 'block' }}
        />
      </div>
    </div>
  )
}
