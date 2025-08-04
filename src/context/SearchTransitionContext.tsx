import { createContext, useContext, useState, ReactNode } from "react";
import { Dimensions } from "react-native";

const { height } = Dimensions.get("window");

export const SearchTransitionContext = createContext({
  startPosition: height * 0.3,
  setStartPosition: (position: number) => {},
  shouldAnimate: false,
  setShouldAnimate: (should: boolean) => {},
});

export const SearchTransitionProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [startPosition, setStartPosition] = useState(height * 0.3);
  const [shouldAnimate, setShouldAnimate] = useState(false);

  return (
    <SearchTransitionContext.Provider
      value={{
        startPosition,
        setStartPosition,
        shouldAnimate,
        setShouldAnimate,
      }}
    >
      {children}
    </SearchTransitionContext.Provider>
  );
};

export const useSearchTransition = () => useContext(SearchTransitionContext);
