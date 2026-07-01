import * as React from "react";
import Svg, { Defs, Line, Mask, Rect } from "react-native-svg";
import { useTheme } from "tamagui";

export type BeyIconProps = {
    size?: number;
    color?: string;
};

const BeyIcon: React.FC<BeyIconProps> = ({ size = 24, color = "$color" }) => {
    const theme = useTheme();

    let resolvedColor = color;
    if (color.startsWith("$")) {
        const tokenName = color.slice(1);
        resolvedColor = theme[tokenName]?.val || color;
    }

    return (
        <Svg width={size} height={size} viewBox="0 0 512 512">
            <Defs>
                <Mask id="cut">
                    {/* White = keep */}
                    <Rect width="100%" height="100%" fill="white" rx={32} />

                    {/* Black = remove */}
                    <Rect
                        x={135}
                        y={135.5}
                        width={230}
                        height={196}
                        rx={12}
                        fill="black"
                    />

                    <Line
                        x1={0}
                        y1={0}
                        x2={500}
                        y2={467}
                        stroke="black"
                        strokeWidth={37}
                        strokeLinecap="square"
                    />
                </Mask>
            </Defs>

            <Rect
                width={500}
                height={467}
                rx={32}
                fill={resolvedColor}
                mask="url(#cut)"
            />
        </Svg>
    );
};

export default BeyIcon;

