import unittest


from api.cas_service import _parse_expr, _verify_steps


class CASServiceTests(unittest.TestCase):
    def test_left_right_absolute_value_normalizes(self):
        self.assertEqual(_parse_expr(r"\left|t\right|"), _parse_expr("|t|"))

    def test_independent_review_steps_do_not_fail_as_bad_derivations(self):
        steps = [
            r"椭圆参数 $a=2$",
            r"$b=\sqrt{3}$",
            r"圆切线截距 $|t|=2\sqrt{3}$",
            r"仿射后直线 $Y=-2X+2$",
            r"单位圆交点 $X=1$ 与 $X=3/5$",
            r"拉回原坐标后斜率分别为 $-\sqrt{3}/2$ 与 $-\sqrt{3}/6$",
            "最终斜率比为 3",
        ]

        result = _verify_steps(steps)

        self.assertTrue(all(item["valid"] is not False for item in result["verifications"]))
        self.assertEqual(result["verifications"][2]["method"], "condition")
        self.assertEqual(result["verifications"][3]["method"], "condition")
        self.assertEqual(result["verifications"][4]["method"], "condition")


if __name__ == "__main__":
    unittest.main()
