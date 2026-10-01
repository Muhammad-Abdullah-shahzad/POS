/**
 * A sale's receipt or invoice shown across the whole screen, with a print
 * button and a close (X) button. Used wherever a past sale can be opened.
 */
import { useRef } from 'react';
import { Box, Button, Group, Modal, Paper, Text } from '@mantine/core';
import { IconPrinter } from '@tabler/icons-react';
import { useReactToPrint } from 'react-to-print';
import { formatMoney } from '../../utils/money';
import { useSettingsStore } from '../../store/settingsStore';
import PrintableSaleDocument from './PrintableSaleDocument';
import { printPageStyle } from './printPageStyle';
import { printableSaleFromOrder } from './printableSaleFromOrder';
import { useShopDetails } from './useShopDetails';

interface ReceiptViewerProps {
  /** The order to show; nothing is shown while it is null. */
  order: any | null;
  opened: boolean;
  onClose: () => void;
}

export default function ReceiptViewer({ order, opened, onClose }: ReceiptViewerProps) {
  const printRef = useRef<HTMLDivElement>(null);
  // Reprints follow the paper size set in Settings, like the till does.
  const settings = useSettingsStore((state) => state.settings);
  const receiptSize: 'Thermal' | 'A4' = settings?.receiptSize === 'A4' ? 'A4' : 'Thermal';
  const shop = useShopDetails();

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    pageStyle: printPageStyle(receiptSize),
    // Receipts carry inline styles only; skipping the app's stylesheets opens the print window faster.
    ignoreGlobalStyles: true,
  });

  return (
    <Modal.Root opened={opened} onClose={onClose} fullScreen transitionProps={{ transition: 'fade', duration: 150 }}>
      <Modal.Overlay />
      <Modal.Content bg="gray.1">
        <Modal.Header bg="white" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
          <Modal.Title>
            <Text fw={700} size="lg">Receipt {order?.invoiceId || ''}</Text>
            {order && (
              <Text size="sm" c="dimmed">
                {new Date(order.createdAt).toLocaleString()} · {formatMoney(order.total)}
              </Text>
            )}
          </Modal.Title>
          <Group gap="sm">
            <Button leftSection={<IconPrinter size={16} />} onClick={() => handlePrint()} disabled={!order}>
              Print {receiptSize === 'A4' ? 'Invoice (A4)' : 'Receipt'}
            </Button>
            <Modal.CloseButton size="xl" aria-label="Close receipt" />
          </Group>
        </Modal.Header>
        <Modal.Body py="xl">
          {order && (
            <Box style={{ overflowX: 'auto' }}>
              <Paper shadow="sm" mx="auto" w="fit-content" maw="100%">
                <div ref={printRef}>
                  <PrintableSaleDocument sale={printableSaleFromOrder(order)} shop={shop} size={receiptSize} />
                </div>
              </Paper>
            </Box>
          )}
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}
