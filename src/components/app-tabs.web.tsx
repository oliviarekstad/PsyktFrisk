
import React, { forwardRef } from "react";

import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  type TabTriggerSlotProps,
  type TabListProps,
} from "expo-router/ui";

import {
  Pressable,
  View,
  StyleSheet,
  type View as ViewType,
} from "react-native";

// ==================================================
// 1. FARGER – PSYKTFRISK
// ==================================================

const COLORS = {
  background: "#F8F6F2",
  primary: "#456B60",
  primaryDark: "#34594D",
  selected: "#E6EEE8",
  white: "#FFFFFF",
};

// ==================================================
// 2. HOVEDNAVIGASJON
// ==================================================

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={styles.content} />

      <TabList asChild>
        <CustomTabList>
          {/* Hjem */}
          <TabTrigger
            name="home"
            href="/"
            asChild
          >
            <TabButton>Hjem</TabButton>
          </TabTrigger>

          {/* Dagbokskort */}
          <TabTrigger
            name="diary"
            href="/diary"
            asChild
          >
            <TabButton>Dagbokskort</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

// ==================================================
// 3. KNAPP FOR HVER FANE
// ==================================================

// forwardRef gjør at Expo Router kan sende en ref
// videre til den underliggende Pressable-komponenten.

export const TabButton = forwardRef<
  React.ComponentRef<typeof Pressable>,
  TabTriggerSlotProps
>(function TabButton(
  {
    children,
    isFocused,
    style: _style,
    ...props
  },
  ref
) {
  return (
    <Pressable
      {...props}
      ref={ref}
      style={({ pressed }) => [
        styles.tabButton,
        isFocused && styles.tabButtonSelected,
        pressed && styles.pressed,
      ]}
    >
      <View>
        <TextLabel selected={!!isFocused}>
          {children}
        </TextLabel>
      </View>
    </Pressable>
  );
});

// ==================================================
// 4. TEKST I NAVIGASJONSKNAPPENE
// ==================================================

function TextLabel({
  children,
  selected,
}: {
  children: React.ReactNode;
  selected: boolean;
}) {
  return (
    <View>
      <TabText selected={selected}>
        {children}
      </TabText>
    </View>
  );
}

import { Text } from "react-native";

function TabText({
  children,
  selected,
}: {
  children: React.ReactNode;
  selected: boolean;
}) {
  return (
    <Text
      style={[
        styles.tabText,
        selected && styles.tabTextSelected,
      ]}
    >
      {children}
    </Text>
  );
}

// ==================================================
// 5. NAVIGASJONSLISTE
// ==================================================


export const CustomTabList = forwardRef<
  React.ComponentRef<typeof View>,
  TabListProps
>(function CustomTabList(
  { children, style: _style, ...props },
  ref
) {
  return (
    <View
      {...props}
      ref={ref}
      style={styles.tabListContainer}
    >
      <View style={styles.innerContainer}>
        <Text style={styles.brandText}>
          PsyktFrisk
        </Text>

        {children}
      </View>
    </View>
  );
});


// ==================================================
// 6. DESIGN
// ==================================================

const styles = StyleSheet.create({
  content: {
    height: "100%",
    backgroundColor: COLORS.background,
  },

  tabListContainer: {
    position: "absolute",
    width: "100%",
    padding: 12,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },

  innerContainer: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    flexGrow: 1,
    gap: 8,
    maxWidth: 900,
    backgroundColor: COLORS.white,
  },

  brandText: {
    marginRight: "auto",
    color: COLORS.primary,
    fontWeight: "700",
    fontSize: 17,
  },

  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },

  tabButtonSelected: {
    backgroundColor: COLORS.selected,
  },

  pressed: {
    opacity: 0.7,
  },

  tabText: {
    color: COLORS.primaryDark,
    fontSize: 14,
    fontWeight: "500",
  },

  tabTextSelected: {
    color: COLORS.primary,
    fontWeight: "700",
  },
});
