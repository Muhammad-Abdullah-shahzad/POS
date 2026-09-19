/**
 * The frame for a KPI detail view: a title with its period, on the
 * dashboard's lavender wash. Full screen on phones.
 */
import type { ReactNode } from 'react';
import { Modal } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import classes from './DetailModal.module.css';

const MODAL_WIDTH = 760;

interface DetailModalProps {
  opened: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export default function DetailModal({ opened, onClose, title, subtitle, children }: DetailModalProps) {
  const isPhone = useMediaQuery('(max-width: 600px)');

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size={MODAL_WIDTH}
      fullScreen={Boolean(isPhone)}
      centered={!isPhone}
      overlayProps={{ color: '#161a45', backgroundOpacity: 0.35, blur: 3 }}
      transitionProps={{ transition: 'pop', duration: 180 }}
      classNames={{ root: classes.root, content: classes.content, header: classes.header, body: classes.body, close: classes.close }}
      title={
        <>
          <span className={classes.title}>{title}</span>
          {subtitle && <span className={classes.subtitle}>{subtitle}</span>}
        </>
      }
    >
      <div className={classes.stack}>{children}</div>
    </Modal>
  );
}
