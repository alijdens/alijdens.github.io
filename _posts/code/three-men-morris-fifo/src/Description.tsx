import { useEffect, useState } from 'react';
import { Popper, Paper } from '@mui/material';
import { useReactFlow } from '@xyflow/react';
import { PopperProps } from '@mui/material/Popper/BasePopper.types';

type DescriptionProps = {
  content: string,
  nodeId: string | null,
}

export default function Description({ content, nodeId }: DescriptionProps) {
  const { getNode } = useReactFlow();

  const getBoundingClientRect = (): DOMRect => {
    if (nodeId) {
      const node = getNode(nodeId);
      if (node) {
        const nodeElement = document.querySelector(`[data-id="${node.id}"]`);
        if (nodeElement) {
          return nodeElement.getBoundingClientRect();
        }
      }
    }

    // node not found or set, center it horizontally in the screen
    const { availWidth } = window.screen;
    return new DOMRect(availWidth / 2, 0, 0, 0);
  };

  const [popperAnchor, setPopperAnchor] = useState<PopperProps['anchorEl']>({ getBoundingClientRect });

  useEffect(() => {
    setPopperAnchor({ getBoundingClientRect });
  }, [nodeId, getNode]);

  return (
    <Popper
      sx={{ transition: 'transform 0.3s ease' }}
      open={Boolean(content)}
      anchorEl={popperAnchor}
      placement="top"
      modifiers={[
        {
          name: 'offset',
          options: {
            offset: [0, 20],
          },
        },
      ]}
    >
      <Paper sx={{ p: 2, border: 1, bgcolor: 'background.paper' }}>
        {content}
      </Paper>
    </Popper>
  );
};
