import type { ReactNode } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { color, radius, type } from '../theme'

interface SheetProps {
  open: boolean
  title: string
  onClose: () => void
  footer?: ReactNode
  children?: ReactNode
}

/**
 * Bottom sheet: a scrim you can tap to dismiss, over a panel pinned to the
 * bottom of the screen. The web build animated a translated div; here it is a
 * native Modal, which brings the platform's own dismissal behaviour with it.
 */
export function Sheet({ open, title, onClose, footer, children }: SheetProps) {
  const insets = useSafeAreaInsets()

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={s.root}>
        <Pressable style={s.scrim} onPress={onClose} accessibilityLabel="Close" />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[s.panel, { paddingBottom: insets.bottom + 16 }]}>
            <View style={s.grabber} />

            <View style={s.head}>
              <Text style={s.title}>{title}</Text>
              <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12}>
                <Text style={s.close}>Close</Text>
              </Pressable>
            </View>

            <ScrollView
              style={s.body}
              contentContainerStyle={s.bodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>

            {footer ? <View style={s.footer}>{footer}</View> : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  panel: {
    backgroundColor: color.island,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '88%',
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 12,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
  },
  title: { ...type.title, fontSize: 20, color: color.text },
  close: { ...type.chip, color: color.textSoft },
  body: { flexGrow: 0 },
  bodyContent: { paddingBottom: 12 },
  footer: { paddingTop: 12 },
})
