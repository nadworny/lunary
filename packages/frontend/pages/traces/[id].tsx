import DurationBadge from "@/components/blocks/DurationBadge"
import RunInputOutput from "@/components/blocks/RunInputOutput"
import StatusBadge from "@/components/blocks/StatusBadge"
import TokensBadge from "@/components/blocks/TokensBadge"
import { useProjectSWR, useRun } from "@/utils/dataHooks"
import { capitalize, formatCost } from "@/utils/format"
import {
  Badge,
  Box,
  Card,
  Group,
  Loader,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core"
import {
  IconCloudDownload,
  IconCode,
  IconLink,
  IconMessage,
  IconMessages,
  IconRobot,
  IconTool,
} from "@tabler/icons-react"
import { useRouter } from "next/router"
import { useEffect, useState } from "react"
import { getColorForRunType } from "../../utils/colors"

import RunsChat from "@/components/blocks/RunChat"

const typeIcon = {
  convo: IconMessages,
  chain: IconLink,
  thread: IconMessages,
  chat: IconMessage,
  agent: IconRobot,
  llm: IconCode,
  tool: IconTool,
  retriever: IconCloudDownload,
}

function TraceTree({
  isFirst = false,
  isLastOfParent = false,
  focused,
  parentId,
  runs,
  onSelect,
  firstDate,
}) {
  // each run contains a child_runs array containing the ids of the runs it spawned
  const run = runs.find((run) => run.id === parentId)
  if (run.input === "__NOT_INGESTED__") {
    run.status = "filtered"
  }

  const color = getColorForRunType(run?.type)

  const showStatus = !["convo", "thread", "chat"].includes(run?.type)

  const Icon = typeIcon[run?.type]

  const isActive = run.id === focused

  const shownRuns = runs
    .filter((run) => run.parentRunId === parentId)
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )

  return (
    <Group pos="relative">
      {!isFirst && (
        <Box>
          {!isLastOfParent && (
            <svg
              width={20}
              strokeWidth={1}
              stroke="var(--mantine-color-gray-5)"
              fill="none"
              style={{
                position: "absolute",
                left: 1,
                top: -3,
                height: "calc(100% + 3px",
              }}
            >
              <line x1={10} y1="0" x2={10} y2="100%" />
            </svg>
          )}
          <svg
            width="38"
            height="38"
            style={{
              position: "absolute",
              left: 3,
              top: -20,
            }}
            viewBox="0 0 24 24"
            strokeWidth={1}
            strokeLinecap="square"
            stroke="var(--mantine-color-gray-5)"
            fill="none"
            strokeLinejoin="round"
          >
            <path
              d="M19 19h-6a8 8 0 0 1 -8 -8v-6"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          <Text>&emsp;</Text>
        </Box>
      )}
      <div>
        <Group
          mb="sm"
          onClick={() => onSelect(run.id)}
          style={{ cursor: "pointer" }}
        >
          {showStatus && <StatusBadge minimal status={run.status} />}

          <Badge
            variant={isActive ? "filled" : "outline"}
            color={color}
            pl={0}
            pr={5}
            maw="250px"
            leftSection={
              Icon && (
                <ThemeIcon
                  variant="subtle"
                  color={isActive ? "white" : color}
                  size="xs"
                  radius="lg"
                >
                  <Icon strokeWidth={2} size={13} />
                </ThemeIcon>
              )
            }
          >
            {run?.name || run?.type}
          </Badge>

          {run?.type === "llm" && run.cost && (
            <Badge variant="outline" color="gray">
              {formatCost(run.cost)}
            </Badge>
          )}

          {run.endedAt && (
            <DurationBadge
              cached={run.metadata?.cache}
              createdAt={run.createdAt}
              endedAt={run.endedAt}
            />
          )}

          {/* {timeAfterFirst > 0 && (
              <Text c="dimmed" fz="xs">
                T + {(timeAfterFirst / 1000).toFixed(2)}s
              </Text>
            )} */}
        </Group>

        {shownRuns.map((run, k) => (
          <TraceTree
            key={run.id}
            isLastOfParent={k === shownRuns.length - 1}
            parentId={run.id}
            focused={focused}
            runs={runs}
            onSelect={onSelect}
            firstDate={firstDate}
          />
        ))}
      </div>
    </Group>
  )
}

function RenderRun({ run, relatedRuns }) {
  const directChilds = relatedRuns
    ?.filter((r) => r.parentRunId === run.id)
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )

  if (run?.type === "chat") return <RunsChat runs={[run]} />
  if (run?.type === "thread") return <RunsChat runs={directChilds} />
  return <RunInputOutput initialRun={run} withFeedback={true} />
}

export default function AgentRun({}) {
  const router = useRouter()
  const { id } = router.query

  const [focused, setFocused] = useState(id)

  const { run } = useRun(id as string)

  useEffect(() => {
    if (run) setFocused(run.id)
  }, [run])

  const { data: relatedRuns } = useProjectSWR(`/runs/${id}/related`)

  if (!run) return <Loader />

  const totalTokens = relatedRuns?.reduce((acc, run) => {
    if (run?.type === "llm") {
      return acc + run.completionTokens + run.promptTokens
    }
    return acc
  }, 0)

  const totalCost = relatedRuns?.reduce((acc, run) => {
    if (run?.type === "llm") {
      return acc + run.cost
    }
    return acc
  }, 0)

  const focusedRun = relatedRuns?.find((run) => run.id === focused)

  return (
    <Stack p="24px 24px 0 24px" h="100vh" gap="xl">
      <Title order={1}>
        {capitalize(run?.type)} Trace {run.name ? `(${run.name})` : ""}
      </Title>
      <Group>
        {run.status && <StatusBadge status={run.status} />}
        {run.createdAt && (
          <Text>{`Started at ${new Date(
            run.createdAt,
          ).toLocaleString()}`}</Text>
        )}
        <TokensBadge tokens={totalTokens} />
        {totalCost && (
          <Badge variant="outline" color="gray">
            {formatCost(totalCost)}
          </Badge>
        )}
        {run.endedAt && (
          <DurationBadge createdAt={run.createdAt} endedAt={run.endedAt} />
        )}
      </Group>

      <Group style={{ flex: 1, minHeight: 0 }}>
        <Box style={{ flex: "0 0 600px", overflowY: "auto", height: "100%" }}>
          {relatedRuns && (
            <TraceTree
              isFirst
              focused={focused}
              onSelect={setFocused}
              parentId={id}
              runs={relatedRuns}
              firstDate={run.createdAt}
            />
          )}
        </Box>

        <Box style={{ flex: "1 1 400px", overflowY: "auto", height: "100%" }}>
          <Box p="md">
            <Card
              withBorder
              style={{
                position: "sticky",
                top: 0,
                maxHeight: "calc(100vh - 200px)",
                overflow: "auto",
              }}
            >
              <RenderRun run={focusedRun} relatedRuns={relatedRuns} />
            </Card>
          </Box>
        </Box>
      </Group>
    </Stack>
  )
}
